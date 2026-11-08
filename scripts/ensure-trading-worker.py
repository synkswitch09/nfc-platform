"""Provision a dedicated HTTP research worker only when the deployed private module is enabled."""
import json
import os
import subprocess
import tempfile


def az(*args):
    result = subprocess.run(["az", *args, "--output", "json", "--only-show-errors"], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Trading worker provisioning failed; inspect Azure permissions/configuration")
    return json.loads(result.stdout) if result.stdout.strip() else None


def main():
    target = os.environ.get("TARGET_ENVIRONMENT")
    if target not in ("staging", "production"):
        raise RuntimeError("Unsupported environment")
    group, app_name = os.environ["AZURE_RESOURCE_GROUP"], os.environ["AZURE_CONTAINER_APP"]
    app = az("containerapp", "show", "--name", app_name, "--resource-group", group)
    entries = {e["name"]: e for e in app["properties"]["template"]["containers"][0].get("env", [])}
    if entries.get("APP_ENV", {}).get("value") != target:
        raise RuntimeError("Application environment mismatch")
    if entries.get("TRADING_ENABLED", {}).get("value") != "true":
        print("Trading disabled; no research worker created")
        return
    values = {e["name"]: e.get("value") for e in az("containerapp", "secret", "list", "--name", app_name, "--resource-group", group, "--show-values")}
    def resolve(name):
        entry = entries.get(name, {})
        return values.get(entry.get("secretRef")) if entry.get("secretRef") else entry.get("value")
    if not resolve("TRADING_OWNER_USER_ID"):
        raise RuntimeError("Set the private trading owner before provisioning its worker")
    token = resolve("TRADING_WORKER_SECRET") or resolve("CHECKOUT_RECONCILE_SECRET")
    if not token or len(token) < 32:
        raise RuntimeError("Configure a trading/reconciliation worker secret of at least 32 characters")
    name = app_name + "-trading"
    jobs = az("containerapp", "job", "list", "--resource-group", group)
    for job in jobs:
        if job["name"] == name and job.get("tags", {}).get("managed-by") != "trading-research-worker":
            raise RuntimeError("An unmanaged job already uses the trading worker name")
    secrets = [{"name": "worker", "value": token}]
    registries = []
    for registry in app["properties"].get("configuration", {}).get("registries", []):
        if registry.get("server") != "ghcr.io":
            continue
        if registry.get("identity"):
            raise RuntimeError("Configure registry identity for the research job explicitly")
        password = values.get(registry.get("passwordSecretRef"))
        if password:
            secrets.append({"name": "registry", "value": password})
            registries.append({"server": "ghcr.io", "username": registry["username"], "passwordSecretRef": "registry"})
    production = target == "production"
    config = {"triggerType": "Schedule" if production else "Manual", "replicaTimeout": 300, "replicaRetryLimit": 0,
              "registries": registries, "secrets": secrets}
    if production:
        config["scheduleTriggerConfig"] = {"cronExpression": "*/5 * * * *", "parallelism": 1, "replicaCompletionCount": 1}
    else:
        config["manualTriggerConfig"] = {"parallelism": 1, "replicaCompletionCount": 1}
    properties = {"environmentId": app["properties"]["environmentId"], "configuration": config,
                  "template": {"containers": [{"name": "research", "image": os.environ["IMAGE"], "command": ["node"],
                    "args": ["/app/scripts/trading-worker.mjs"], "resources": {"cpu": 0.25, "memory": "0.5Gi"},
                    "env": [{"name": "APP_URL", "value": os.environ["APP_URL"].rstrip("/")}, {"name": "TRADING_WORKER_SECRET", "secretRef": "worker"}]}]}}
    if app["properties"].get("workloadProfileName"):
        properties["workloadProfileName"] = app["properties"]["workloadProfileName"]
    body = {"location": app["location"], "tags": {"managed-by": "trading-research-worker", "environment": target}, "properties": properties}
    job_id = app["id"].rsplit("/", 2)[0] + "/jobs/" + name
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json") as payload:
        json.dump(body, payload)
        payload.flush()
        az("rest", "--method", "put", "--url", job_id + "?api-version=2024-03-01", "--body", "@" + payload.name)
    print("Research worker configured: " + ("every five minutes" if production else "manual staging job") + "; no broker/API credentials copied to the job")


if __name__ == "__main__":
    main()
