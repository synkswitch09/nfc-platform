import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("order_worker", Path(__file__).parents[1] / "scripts/ensure-order-worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class OrderWorkerTests(unittest.TestCase):
    def test_both_environments_create_or_update_isolated_worker(self):
        for target in ("staging", "production"):
            with self.subTest(target=target):
                calls = []
                body = {}
                app = {"id": "/subscriptions/test/resourceGroups/group/providers/Microsoft.App/containerApps/app", "location": "australiaeast", "properties": {"environmentId": "env-" + target, "configuration": {"registries": []}, "template": {"containers": [{"env": [{"name": "APP_ENV", "value": target}, {"name": "PRODUCTION_CHECKOUT_ENABLED", "value": "false"}]}]}}}
                def az(*args):
                    calls.append(args)
                    if args[:2] == ("containerapp", "show"): return app
                    if args[:3] == ("containerapp", "job", "list"): return [{"name": "app-orders", "tags": {"managed-by": "staging-order-worker"}}]
                    if args[:3] == ("containerapp", "secret", "list"): return []
                    if args[:1] == ("rest",):
                        body.update(json.loads(Path(args[args.index("--body") + 1][1:]).read_text()))
                    if args[:3] == ("containerapp", "job", "show"): return {"properties": {"provisioningState": "Succeeded"}}
                    if args[:3] == ("containerapp", "job", "start"): return {"name": "execution"}
                    if args[:4] == ("containerapp", "job", "execution", "show"): return {"properties": {"status": "Succeeded"}}
                output = io.StringIO()
                with patch.dict(os.environ, {"TARGET_ENVIRONMENT": target, "AZURE_RESOURCE_GROUP": "group", "AZURE_CONTAINER_APP": "app", "APP_URL": "https://" + target + ".example", "IMAGE": "image:" + target}), patch.object(worker, "az", az), contextlib.redirect_stdout(output):
                    worker.main()
                props = body["properties"]
                container = props["template"]["containers"][0]
                self.assertEqual(container["image"], "image:" + target)
                self.assertEqual(container["resources"], {"cpu": 0.25, "memory": "0.5Gi"})
                self.assertEqual(props["configuration"]["scheduleTriggerConfig"]["cronExpression"], "*/5 * * * *")
                self.assertEqual({entry["name"] for entry in container["env"]}, {"APP_URL", "CHECKOUT_RECONCILE_SECRET"})
                token = props["configuration"]["secrets"][0]["value"]
                self.assertGreaterEqual(len(token), 32)
                self.assertNotIn(token, output.getvalue())
                self.assertTrue(any("TRUST_PROXY=true" in call for call in calls))

    def test_refuses_wrong_environment_or_enabled_production_checkout(self):
        for app_env, enabled in [("staging", "false"), ("production", "true")]:
            app = {"id": "app", "properties": {"template": {"containers": [{"env": [{"name": "APP_ENV", "value": app_env}, {"name": "PRODUCTION_CHECKOUT_ENABLED", "value": enabled}]}]}}}
            def az(*args):
                if args[:2] == ("containerapp", "show"): return app
                if args[:3] == ("containerapp", "job", "list"): return []
                raise AssertionError("Must not mutate resources after safety check failure")
            with patch.dict(os.environ, {"TARGET_ENVIRONMENT": "production", "AZURE_RESOURCE_GROUP": "group", "AZURE_CONTAINER_APP": "app", "APP_URL": "https://example"}), patch.object(worker, "az", az):
                with self.assertRaises(RuntimeError): worker.main()

if __name__ == "__main__":
    unittest.main()
