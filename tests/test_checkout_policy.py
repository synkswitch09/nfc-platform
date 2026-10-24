import unittest
import subprocess
import sys
from pathlib import Path
from scripts.checkout_policy import validate_production_checkout


class CheckoutPolicyTests(unittest.TestCase):
    def test_accepts_explicit_closed_or_complete_live_configuration(self):
        self.assertFalse(validate_production_checkout({'PRODUCTION_CHECKOUT_ENABLED':'false'}))
        self.assertTrue(validate_production_checkout(self.live()))

    def live(self):
        return {'PRODUCTION_CHECKOUT_ENABLED':'true','PRODUCTION_PREVIEW_MODE':'false','STRIPE_SECRET_KEY':'sk_live_private','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY':'pk_live_private','STRIPE_WEBHOOK_SECRET':'whsec_private'}

    def test_rejects_missing_or_test_credentials_without_disclosing_values(self):
        for key in ('STRIPE_SECRET_KEY','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET'):
            for value in ('', 'sk_test_do_not_log'):
                values=self.live();values[key]=value
                with self.assertRaises(RuntimeError) as error: validate_production_checkout(values)
                self.assertIn(key,str(error.exception))
                self.assertNotIn('do_not_log',str(error.exception))

    def test_rejects_ambiguous_launch_flags_and_preview(self):
        for value in (None, '', 'TRUE', '1'):
            with self.assertRaises(RuntimeError): validate_production_checkout({'PRODUCTION_CHECKOUT_ENABLED':value})
        values=self.live();values['PRODUCTION_PREVIEW_MODE']='true'
        with self.assertRaises(RuntimeError): validate_production_checkout(values)

    def test_closed_state_matches_runtime_credential_policy(self):
        with self.assertRaises(RuntimeError): validate_production_checkout({'PRODUCTION_CHECKOUT_ENABLED':'false','STRIPE_SECRET_KEY':'sk_live_private'})

    def test_workflow_script_entrypoints_load_the_policy_before_environment_validation(self):
        root=Path(__file__).parents[1]
        for script in ('maintain-azure-env.py','ensure-order-worker.py'):
            result=subprocess.run([sys.executable,str(root/'scripts'/script)],env={},capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertNotIn('ModuleNotFoundError',result.stderr)
            self.assertTrue('TARGET_ENVIRONMENT' in result.stderr or 'requires staging or production' in result.stderr)
