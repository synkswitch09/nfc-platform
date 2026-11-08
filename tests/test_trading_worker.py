import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("trading_worker", Path(__file__).parents[1] / "scripts/ensure-trading-worker.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class TradingWorkerTests(unittest.TestCase):
    def run_worker(self, target="production", enabled=True, jobs=None):
        payload = {}
        app = {"id":"/subscriptions/s/resourceGroups/g/providers/Microsoft.App/containerApps/app", "location":"australiaeast", "properties": {"environmentId":"env", "configuration":{"registries":[]}, "template":{"containers":[{"env":[{"name":"APP_ENV","value":target},{"name":"TRADING_ENABLED","value":"true" if enabled else "false"},{"name":"TRADING_OWNER_USER_ID","value":"owner"},{"name":"CHECKOUT_RECONCILE_SECRET","secretRef":"worker-secret"}]}]}}}
        def az(*args):
            if args[:2] == ("containerapp","show"): return app
            if args[:3] == ("containerapp","secret","list"): return [{"name":"worker-secret","value":"secret-with-at-least-32-characters-for-tests"}]
            if args[:3] == ("containerapp","job","list"): return jobs or []
            if args[0] == "rest": payload.update(json.loads(Path(args[args.index("--body")+1][1:]).read_text()))
        with patch.dict(os.environ,{"TARGET_ENVIRONMENT":target,"AZURE_RESOURCE_GROUP":"g","AZURE_CONTAINER_APP":"app","APP_URL":"https://app.example","IMAGE":"image:sha"}), patch.object(worker,"az",az): worker.main()
        return payload
    def test_production_scheduler_has_only_http_worker_credentials(self):
        result=self.run_worker(); cfg=result['properties']['configuration']; container=result['properties']['template']['containers'][0]
        self.assertEqual(cfg['scheduleTriggerConfig']['cronExpression'],'*/5 * * * *')
        self.assertEqual(container['args'],['/app/scripts/trading-worker.mjs'])
        self.assertEqual({e['name'] for e in container['env']},{'APP_URL','TRADING_WORKER_SECRET'})
        self.assertEqual(cfg['replicaTimeout'],300)
    def test_staging_is_manual_and_disabled_does_not_provision(self):
        self.assertEqual(self.run_worker('staging')['properties']['configuration']['triggerType'],'Manual')
        self.assertEqual(self.run_worker(enabled=False),{})
    def test_unmanaged_job_is_not_overwritten(self):
        with self.assertRaisesRegex(RuntimeError,'unmanaged'): self.run_worker(jobs=[{'name':'app-trading','tags':{}}])
