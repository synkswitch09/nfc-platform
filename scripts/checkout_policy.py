"""Validate the operator's production checkout choice without exposing credentials."""


def validate_production_checkout(values):
    enabled = values.get("PRODUCTION_CHECKOUT_ENABLED")
    if enabled not in ("true", "false"):
        raise RuntimeError("PRODUCTION_CHECKOUT_ENABLED must explicitly be true or false")
    if values.get("PRODUCTION_PREVIEW_MODE", "false") != "false":
        raise RuntimeError("Official production deployment requires PRODUCTION_PREVIEW_MODE=false")
    required = {"STRIPE_SECRET_KEY": "sk_live_", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_", "STRIPE_WEBHOOK_SECRET": "whsec_"}
    if enabled == "true":
        invalid = [name for name, prefix in required.items() if not str(values.get(name) or "").startswith(prefix)]
        if invalid:
            raise RuntimeError("Production checkout configuration missing or invalid: " + ", ".join(invalid))
    elif any(values.get(name) for name in required):
        raise RuntimeError("Closed production checkout requires Stripe credentials to be unset")
    return enabled == "true"
