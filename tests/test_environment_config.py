import contextlib
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('environment_config', Path(__file__).parents[1] / 'scripts/maintain-azure-env.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class EnvironmentConfigTests(unittest.TestCase):
    def app(self, target):
        values = {'APP_ENV':target, 'APP_URL':'https://'+target+'.example', 'PRODUCTION_CHECKOUT_ENABLED':'false', 'PRODUCTION_PREVIEW_MODE':'false', 'EMAIL_WEBHOOK_URL':'https://sandbox.api.mailtrap.io/api/send/123' if target=='staging' else 'https://api.resend.com/emails', 'EMAIL_FROM_ADDRESS':'old@example.test', 'GOOGLE_SITE_VERIFICATION_KOSYKIN':'public-code', 'GOOGLE_SITE_VERIFICATION_TAPKIN':'keep-public-code', 'CUSTOM_INFRA_VAR':'preserve-me', 'EMAIL_RESEND_STORES':'{"tapkin":{"apiKey":"private-resend"}}'}
        refs = {'DATABASE_URL','DATABASE_EXPECTED_NAME','SESSION_SECRET','ACTIVATION_PEPPER','AZURE_STORAGE_CONTAINER_URL','AZURE_STORAGE_SAS_TOKEN','EMAIL_WEBHOOK_SECRET','CHECKOUT_RECONCILE_SECRET','SHIPPIT_'+target.upper()+'_API_SECRET','SHIPPIT_'+target.upper()+'_WEBHOOK_SECRET'}
        if target == 'staging': refs |= {'STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'}
        env = [{'name':key,'value':value} for key,value in values.items()] + [{'name':key,'secretRef':key.lower()} for key in refs]
        return {'properties':{'provisioningState':'Succeeded','template':{'containers':[{'env':env}]}}}, [{'name':key.lower(),'value':'private-'+key} for key in refs]
    def test_normalizes_both_preserves_refs_and_does_not_log_values(self):
        for target in ('staging','production'):
            app, secrets = self.app(target)
            calls = []
            def az(*args):
                calls.append(args)
                if args[:2] == ('containerapp','show'): return app
                if args[:3] == ('containerapp','secret','list'): return secrets
                if args[:2] == ('containerapp','update'):
                    updated = []
                    for entry in args[args.index('--replace-env-vars')+1:]:
                        name,value=entry.split('=',1)
                        updated.append({'name':name,'secretRef':value[10:]} if value.startswith('secretref:') else {'name':name,'value':value})
                    app['properties']['template']['containers'][0]['env']=updated
                    return app
                raise AssertionError('Unexpected Azure operation')
            output=io.StringIO()
            with patch.dict(os.environ, {'TARGET_ENVIRONMENT':target,'AZURE_CONTAINER_APP':'app','AZURE_RESOURCE_GROUP':'group','APP_URL':'https://'+target+'.example','APPLY_CHANGES':'true','AZURE_MIGRATION_JOB':'', 'ALLOW_LEGACY_REMOVAL':'true'}), patch.object(module,'az',az), patch.object(module,'migrate_verification') as migrate, contextlib.redirect_stdout(output): module.main()
            env={item['name']:item for item in app['properties']['template']['containers'][0]['env']}
            self.assertEqual(env['DATABASE_URL']['secretRef'],'database_url')
            self.assertEqual(env['CUSTOM_INFRA_VAR']['value'],'preserve-me')
            self.assertEqual(env['GOOGLE_OAUTH_STORES']['value'],'')
            self.assertEqual(env['GEOAPIFY_STORES'], {'name':'GEOAPIFY_STORES','value':''})
            self.assertNotIn('EMAIL_FROM_ADDRESS',env)
            self.assertNotIn('GOOGLE_SITE_VERIFICATION_TAPKIN',env)
            if target=='production': self.assertNotIn('GOOGLE_SITE_VERIFICATION_KOSYKIN',env)
            migrate.assert_called_once()
            for secret in secrets: self.assertNotIn(secret['value'],output.getvalue())
    def test_verification_migration_overrides_execution_only_and_preserves_database_ref(self):
        import copy, json
        app, secrets = self.app('production')
        job={'id':'/job','properties':{'template':{'containers':[{'name':'migration','image':'current-migrator','resources':{'cpu':0.25,'memory':'0.5Gi'},'command':['prisma'],'args':['migrate','deploy'],'env':[{'name':'APP_ENV','value':'production'},{'name':'DATABASE_EXPECTED_NAME','value':'database'},{'name':'DATABASE_URL','secretRef':'database-secret'}]}]}}}
        before=copy.deepcopy(job)
        submitted={}
        def az(*args):
            if args[:3]==('containerapp','job','show'): return job
            if args[:3]==('containerapp','job','start'):
                submitted.update(json.loads(Path(args[args.index('--yaml')+1]).read_text()))
                return {'name':'execution'}
            if args[:4]==('containerapp','job','execution','show'): return {'properties':{'status':'Succeeded'}}
            raise AssertionError('Unexpected Azure mutation')
        with patch.object(module,'az',az), contextlib.redirect_stdout(io.StringIO()):
            module.migrate_verification(app,{'DATABASE_EXPECTED_NAME':'database','GOOGLE_SITE_VERIFICATION_TAPKIN':'public-token'},'group','job','production')
        self.assertEqual(job,before)
        container=submitted['containers'][0]
        self.assertEqual(container['command'],['node'])
        self.assertIn({'name':'DATABASE_URL','secretRef':'database-secret'},container['env'])
        self.assertIn({'name':'GOOGLE_SITE_VERIFICATION_TAPKIN','value':'public-token'},container['env'])

    def test_does_not_mutate_wrong_environment_or_open_sales(self):
        for mismatch in (True,False):
            app,secrets=self.app('staging' if mismatch else 'production')
            if not mismatch:
                for entry in app['properties']['template']['containers'][0]['env']:
                    if entry['name']=='PRODUCTION_CHECKOUT_ENABLED': entry['value']='true'
            def az(*args):
                if args[:2]==('containerapp','show'): return app
                if args[:3]==('containerapp','secret','list'): return secrets
                raise AssertionError('Should not mutate')
            with patch.dict(os.environ,{'TARGET_ENVIRONMENT':'production','AZURE_CONTAINER_APP':'app','AZURE_RESOURCE_GROUP':'group','APP_URL':'https://production.example','APPLY_CHANGES':'true'}),patch.object(module,'az',az):
                with self.assertRaises(RuntimeError): module.main()
if __name__ == '__main__': unittest.main()
