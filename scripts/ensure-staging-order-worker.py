"""Provision the staging HTTP worker without printing application secrets."""
import json
import os
import secrets as secure_random
import subprocess
import tempfile
import time


def az(*args):
    result = subprocess.run(["az", *args, "--output", "json", "--only-show-errors"], capture_output=True, text=True)
    if result.returncode:
        # Azure errors can contain request bodies. Keep secrets out of Actions logs.
        raise RuntimeError("Azure worker operation failed; inspect resource permissions/configuration in Azure")
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    if os.environ.get("TARGET_ENVIRONMENT") != "staging":
        raise RuntimeError("This provisioner is restricted to staging")
    group, app_name = os.environ["AZURE_RESOURCE_GROUP"], os.environ["AZURE_CONTAINER_APP"]
    origin = os.environ["APP_URL"].rstrip("/")
    app = az("containerapp", "show", "--name", app_name, "--resource-group", group)
    existing = az("containerapp", "job", "list", "--resource-group", group)
    job_name = f"{app_name}-orders"
    for job in existing:
        props = job.get("properties", {})
        if job["name"] == job_name:
            if job.get("tags", {}).get("managed-by") != "staging-order-worker":
                raise RuntimeError("Worker resource name is already used by an unmanaged job")
            continue
        if props.get("environmentId") != app["properties"]["environmentId"]:
            continue
        for container in props.get("template", {}).get("containers", []):
            command = " ".join(container.get("command", []) + container.get("args", []))
            env = {entry["name"]: entry.get("value") for entry in container.get("env", [])}
            if "reconcile-checkouts.mjs" in command and env.get("APP_URL", "").rstrip("/") == origin and props.get("configuration", {}).get("triggerType") == "Schedule":
                print("Existing scheduled staging order worker verified")
                return
    env = {entry["name"]: entry for entry in app["properties"]["template"]["containers"][0].get("env", [])}
    reconcile = env.get("CHECKOUT_RECONCILE_SECRET", {})
    secret_values = {entry["name"]: entry.get("value") for entry in az("containerapp", "secret", "list", "--name", app_name, "--resource-group", group, "--show-values")}
    token = reconcile.get("value") or secret_values.get(reconcile.get("secretRef"))
    if not token:
        token = secure_random.token_urlsafe(48)
        az("containerapp", "secret", "set", "--name", app_name, "--resource-group", group,
           "--secrets", "order-worker-reconcile=" + token)
        az("containerapp", "update", "--name", app_name, "--resource-group", group,
           "--set-env-vars", "CHECKOUT_RECONCILE_SECRET=secretref:order-worker-reconcile")
        print("Configured the missing staging order-worker authentication secret")
    secrets = [{"name": "reconcile", "value": token}]
    registries = []
    for registry in app["properties"].get("configuration", {}).get("registries", []):
        if registry.get("server") != "ghcr.io":
            continue
        if registry.get("identity"):
            raise RuntimeError("Managed registry identity requires explicit worker identity configuration")
        password = secret_values.get(registry.get("passwordSecretRef"))
        if password:
            secrets.append({"name": "registry", "value": password})
            registries.append({"server": "ghcr.io", "username": registry["username"], "passwordSecretRef": "registry"})
    properties = {
        "environmentId": app["properties"]["environmentId"],
        "configuration": {"triggerType": "Schedule", "replicaTimeout": 240, "replicaRetryLimit": 0,
                          "scheduleTriggerConfig": {"cronExpression": "*/5 * * * *", "parallelism": 1, "replicaCompletionCount": 1},
                          "registries": registries, "secrets": secrets},
        "template": {"containers": [{"name": "orders", "image": os.environ["IMAGE"],
                                      "command": ["node"], "args": ["/app/scripts/reconcile-checkouts.mjs"],
                                      "resources": {"cpu": 0.25, "memory": "0.5Gi"},
                                      "env": [{"name": "APP_URL", "value": origin}, {"name": "CHECKOUT_RECONCILE_SECRET", "secretRef": "reconcile"}]}]},
    }
    if app["properties"].get("workloadProfileName"):
        properties["workloadProfileName"] = app["properties"]["workloadProfileName"]
    body = {"location": app["location"], "tags": {"managed-by": "staging-order-worker"}, "properties": properties}
    job_id = app["id"].rsplit("/", 2)[0] + "/jobs/" + job_name
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as payload:
        json.dump(body, payload)
        payload.flush()
        az("rest", "--method", "put", "--url", f"{job_id}?api-version=2024-03-01", "--body", "@" + payload.name)
    for _ in range(60):
        job = az("containerapp", "job", "show", "--name", job_name, "--resource-group", group)
        state = job["properties"].get("provisioningState")
        if state == "Succeeded":
            break
        if state in ("Failed", "Canceled"):
            raise RuntimeError("Staging worker provisioning failed")
        time.sleep(5)
    else:
        raise RuntimeError("Staging worker provisioning timed out")
    execution = az("containerapp", "job", "start", "--name", job_name, "--resource-group", group)["name"]
    for _ in range(60):
        result = az("containerapp", "job", "execution", "show", "--name", job_name, "--resource-group", group, "--job-execution-name", execution)
        status = result["properties"].get("status")
        if status == "Succeeded":
            print("Staging order worker configured every five minutes; first execution succeeded")
            return
        if status in ("Failed", "Canceled", "Cancelled"):
            raise RuntimeError("Staging order worker execution failed; inspect the job logs in Azure")
        time.sleep(5)
    raise RuntimeError("Staging order worker execution timed out")


if __name__ == "__main__":
    main()
