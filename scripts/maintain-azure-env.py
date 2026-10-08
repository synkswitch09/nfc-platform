"""Audit and normalize Azure app configuration without logging secret values."""
import json
import os
import re
import subprocess
import time


def az(*args):
    result = subprocess.run(["az", *args, "--output", "json", "--only-show-errors"], capture_output=True, text=True)
    if result.returncode:
        # Emit only the provider error code, never request bodies or secret values.
        match = re.search(r"ERROR: \(([A-Za-z0-9]+)\)", result.stderr)
        raise RuntimeError("Azure operation failed: " + (match.group(1) if match else "unclassified"))
    return json.loads(result.stdout) if result.stdout.strip() else None


def inspect(data, secrets):
    env = {item["name"]: item for item in data["properties"]["template"]["containers"][0].get("env", [])}
    values = {name: item.get("value") if not item.get("secretRef") else secrets.get(item["secretRef"]) for name, item in env.items()}
    return env, values


def main():
    target = os.environ["TARGET_ENVIRONMENT"]
    if target not in ("staging", "production"):
        raise RuntimeError("Invalid environment")
    group, name = os.environ["AZURE_RESOURCE_GROUP"], os.environ["AZURE_CONTAINER_APP"]
    app = az("containerapp", "show", "--name", name, "--resource-group", group)
    secrets = {item["name"]: item.get("value") for item in az("containerapp", "secret", "list", "--name", name, "--resource-group", group, "--show-values")}
    env, values = inspect(app, secrets)
    if values.get("APP_ENV") != target:
        raise RuntimeError("Environment mismatch")
    if values.get("APP_URL", "").rstrip("/") != os.environ["APP_URL"].rstrip("/"):
        raise RuntimeError("Origin does not match deployment configuration")
    defaults = {"NODE_ENV": "production", "TRUST_PROXY": "true", "PORT": "3000", "STORAGE_PROVIDER": "azure-blob", "STORAGE_ENVIRONMENT": target,
                "EMAIL_MODE": "sandbox" if target == "staging" else "live", "EMAIL_PROVIDER": "mailtrap-sandbox" if target == "staging" else "resend"}
    if target == "production":
        defaults["EMAIL_WEBHOOK_URL"] = "https://api.resend.com/emails"
        # Never open or close sales as part of configuration cleanup.
        if values.get("PRODUCTION_CHECKOUT_ENABLED") != "false" or values.get("PRODUCTION_PREVIEW_MODE", "false") != "false":
            raise RuntimeError("Production launch flags changed; manual reconciliation required")
    else:
        if not re.fullmatch(r"https://sandbox\.api\.mailtrap\.io/api/send/[1-9][0-9]*", values.get("EMAIL_WEBHOOK_URL", "")):
            raise RuntimeError("Staging needs its existing Mailtrap inbox URL")
    changes = {key: value for key, value in defaults.items() if values.get(key) != value}
    if "GOOGLE_OAUTH_STORES" not in env:
        changes["GOOGLE_OAUTH_STORES"] = ""
    obsolete = {"EMAIL_FROM_ADDRESS", "EMAIL_FROM_ADDRESS_KOSYKIN"}
    remove = set(env) & obsolete
    if target == "staging":
        remove |= set(env) & {"PRODUCTION_CHECKOUT_ENABLED", "PRODUCTION_PREVIEW_MODE", "SHIPPIT_PRODUCTION_API_SECRET", "SHIPPIT_PRODUCTION_WEBHOOK_SECRET"}
    else:
        remove |= set(env) & {"SHIPPIT_STAGING_API_SECRET", "SHIPPIT_STAGING_WEBHOOK_SECRET"}
    remove |= {key for key in ("APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "UPLOAD_DIR", "EMAIL_TEST_OUTBOX_PATH", "DEV_ADMIN_EMAIL", "DEV_ADMIN_PASSWORD", "STAGING_ADMIN_EMAIL", "STAGING_ADMIN_PASSWORD") if key in env and not values.get(key)}
    # This store's verification was saved and confirmed in the CMS. Tapkin still uses its fallback.
    if target == "production":
        remove |= set(env) & {"GOOGLE_SITE_VERIFICATION_KOSYKIN"}
    print("Environment: " + target)
    print("Planned updates (names only): " + ", ".join(sorted(changes)))
    print("Planned removals (names only): " + ", ".join(sorted(remove)))
    if os.environ.get("APPLY_CHANGES") == "true" and (changes or remove):
        final = {key: item for key, item in env.items() if key not in remove}
        final.update({key: {"name": key, "value": value} for key, value in changes.items()})
        entries = [key + "=" + ("secretref:" + item["secretRef"] if item.get("secretRef") else item.get("value", "")) for key, item in final.items()]
        az("containerapp", "update", "--name", name, "--resource-group", group, "--replace-env-vars", *entries)
        for _ in range(60):
            app = az("containerapp", "show", "--name", name, "--resource-group", group)
            if app["properties"].get("provisioningState") == "Succeeded":
                break
            time.sleep(5)
        else:
            raise RuntimeError("Application update did not finish")
        env, values = inspect(app, secrets)
        if any(values.get(key) != value for key, value in changes.items()) or set(env) & remove:
            raise RuntimeError("Configuration changes were not applied")
        print("Application configuration changes verified")
    required = {"DATABASE_URL", "DATABASE_EXPECTED_NAME", "SESSION_SECRET", "ACTIVATION_PEPPER", "AZURE_STORAGE_CONTAINER_URL", "AZURE_STORAGE_SAS_TOKEN", "EMAIL_WEBHOOK_SECRET", "CHECKOUT_RECONCILE_SECRET", "SHIPPIT_" + target.upper() + "_API_SECRET", "SHIPPIT_" + target.upper() + "_WEBHOOK_SECRET"}
    if target == "staging":
        required |= {"STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"}
    print("Configuration inventory (no values):")
    for key in sorted(env):
        item = env[key]
        state = "secret:" + item["secretRef"] if item.get("secretRef") else "plain" if values.get(key) else "empty"
        print(key + " | " + state + " | " + ("configured" if values.get(key) else "not configured"))
    missing = sorted(key for key in required if not values.get(key))
    print("Missing required configuration: " + (", ".join(missing) or "none"))
    oauth = values.get("GOOGLE_OAUTH_STORES")
    if oauth:
        try:
            credentials = json.loads(oauth)
            for slug in ("kosykin", "tapkin"):
                entry = credentials.get(slug, {})
                print("Google " + slug + ": " + ("configured" if entry.get("clientId") and entry.get("clientSecret") else "credentials needed"))
        except (ValueError, AttributeError):
            raise RuntimeError("Invalid GOOGLE_OAUTH_STORES structure")
    else:
        print("Google per-store credentials needed: GOOGLE_OAUTH_STORES")
    if missing:
        raise RuntimeError("Required configuration missing; see names above")
    # Migration job has its own minimal scope. Remove only the old sender fields.
    migration_name = os.environ.get("AZURE_MIGRATION_JOB")
    if migration_name and os.environ.get("APPLY_CHANGES") == "true":
        job = az("containerapp", "job", "show", "--name", migration_name, "--resource-group", group)
        job_names = {entry["name"] for container in job["properties"]["template"]["containers"] for entry in container.get("env", [])}
        old = job_names & obsolete
        if old:
            az("containerapp", "job", "update", "--name", migration_name, "--resource-group", group, "--remove-env-vars", *sorted(old))
        print("Migration job obsolete sender fields: none")


if __name__ == "__main__":
    main()
