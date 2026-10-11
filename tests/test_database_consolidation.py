import importlib.util
from pathlib import Path
import unittest
import types
import sys
from unittest.mock import patch, MagicMock

spec=importlib.util.spec_from_file_location('consolidation',Path(__file__).resolve().parents[1]/'scripts/database-consolidation-run.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ConsolidationSafety(unittest.TestCase):
    def test_destination_cannot_be_production_database(self):
        valid='postgresql://staging:private@'+m.TARGET_HOST+'/tapkin_staging?sslmode=require'
        m.guard_url(valid,m.TARGET_HOST,'tapkin_staging')
        for invalid in (valid.replace('/tapkin_staging','/tapkin_production'),valid.replace(m.TARGET_HOST,m.SOURCE_HOST),valid.replace('staging:private','staging')):
            with self.assertRaises(RuntimeError):m.guard_url(invalid,m.TARGET_HOST,'tapkin_staging')
    def test_retirement_never_starts_without_verified_cutover(self):
        for phase in ('prepared','copy-verified','rolled-back','retirement-started'):
            with patch.object(m,'az') as cli:
                with self.assertRaises(RuntimeError):m.retirement({'phase':phase})
                cli.assert_not_called()
    def test_backup_mismatch_prevents_deletion(self):
        target='postgresql://'+m.ROLE+':private@'+m.TARGET_HOST+'/tapkin_staging?sslmode=require'
        with patch.object(m,'db_url',return_value=target),patch.object(m,'az',return_value=[] ) as cli,patch.object(m,'revisions',return_value=[{'properties':{'active':True,'template':{'containers':[{'env':[{'name':'DATABASE_URL','secretRef':m.SECRET}]}]}}}]),patch.object(m,'blob_read',return_value=b'wrong'),patch.object(m,'health') as health:
            with self.assertRaises(RuntimeError):m.retirement({'phase':'cutover-verified','backup':'private.dump','backupSha256':'mismatch'})
            health.assert_not_called()
            self.assertFalse(any('delete' in call.args for call in cli.call_args_list))

    def test_active_legacy_revision_prevents_retirement(self):
        target='postgresql://'+m.ROLE+':private@'+m.TARGET_HOST+'/tapkin_staging?sslmode=require'
        legacy={'properties':{'active':True,'template':{'containers':[{'env':[{'name':'DATABASE_URL','secretRef':'database-url-vnet'}]}]}}}
        with patch.object(m,'db_url',return_value=target),patch.object(m,'revisions',return_value=[legacy]),patch.object(m,'az') as cli:
            with self.assertRaises(RuntimeError):m.retirement({'phase':'cutover-verified'})
            cli.assert_not_called()

    def test_already_active_revision_needs_no_activation_request(self):
        revision={'name':'app--new','properties':{'active':True}}
        with patch.object(m,'show',return_value={'id':'/app'}),patch.object(m,'revisions',return_value=[revision]),patch.object(m,'az') as cli:
            self.assertEqual(m.activate_revision('app--new'),revision)
            cli.assert_not_called()

    def test_drain_requires_an_active_verified_target_before_touching_old_revision(self):
        app={'id':'/app','properties':{'latestRevisionName':'app--new','template':{'containers':[{'env':[{'name':'DATABASE_URL','secretRef':m.SECRET}]}]}}}
        revision={'name':'app--new','properties':{'active':False,'template':{'containers':[{'env':[{'name':'DATABASE_URL','secretRef':m.SECRET}]}]}}}
        with patch.object(m,'show',return_value=app),patch.object(m,'revisions',return_value=[revision]),patch.object(m,'az') as cli:
            with self.assertRaises(RuntimeError):m.reconcile_target_revisions()
            cli.assert_not_called()

class PostgreSQLClientSafety(unittest.TestCase):
    def load_worker(self):
        fake=types.ModuleType('psycopg2');fake.sql=types.SimpleNamespace()
        spec=importlib.util.spec_from_file_location('migration_worker',Path(__file__).resolve().parents[1]/'ops/database-consolidation/worker.py')
        worker=importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules,{'psycopg2':fake}):spec.loader.exec_module(worker)
        return worker
    def test_known_clone_cannot_overwrite_independently_changed_data(self):
        worker=self.load_worker()
        with patch.object(worker,'restricted_target'),patch.object(worker,'manifest',return_value={'tables':{'User':{'count':2}}}),patch.dict(worker.os.environ,{'EXPECTED_CLONE_MANIFEST':'{"tables":{"User":{"count":1}}}'}):
            with self.assertRaisesRegex(RuntimeError,'changed independently'):worker.known_clone(None,{})
    def test_restore_retains_app_objects_and_comments_without_replacing_builtin_language(self):
        worker=self.load_worker()
        toc='4; 3079 100 EXTENSION - plpgsql\n8; 0 0 COMMENT - EXTENSION plpgsql\n20; 1259 123 TABLE public Product owner\n21; 0 123 TABLE DATA public Product owner\n22; 0 0 COMMENT public TABLE Product owner\n'
        filtered=worker.restore_toc(toc)
        self.assertNotIn('EXTENSION - plpgsql',filtered)
        self.assertNotIn('COMMENT - EXTENSION plpgsql',filtered)
        self.assertIn('TABLE DATA public Product',filtered)
        self.assertIn('COMMENT public TABLE Product',filtered)
    def test_restore_error_diagnostics_never_include_row_values(self):
        worker=self.load_worker()
        error=types.SimpleNamespace(returncode=1,stdout=b'',stderr=b'ERROR: must be owner of extension plpgsql\nDETAIL: private customer value')
        with patch.object(worker.subprocess,'run',return_value=error):
            with self.assertRaisesRegex(RuntimeError,'builtin extension ownership') as result:worker.pg_tool('pg_restore',{})
            self.assertNotIn('private customer',str(result.exception))
    def test_implicit_client_tls_is_upgraded_to_verified_tls(self):
        worker=self.load_worker()
        params=worker.connection_parameters('postgresql://stage:private@'+m.SOURCE_HOST+'/tapkin_staging',m.SOURCE_HOST,'tapkin_staging')
        self.assertEqual(params['sslmode'],'verify-full')
        with self.assertRaises(ValueError):worker.connection_parameters('postgresql://stage:private@'+m.SOURCE_HOST+'/tapkin_staging?sslmode=disable',m.SOURCE_HOST,'tapkin_staging')
    def test_literal_percent_in_catalog_query_is_not_a_bind_placeholder(self):
        worker=self.load_worker()
        cursor=MagicMock();cursor.description=None
        def execute(statement, parameters):
            if parameters is not None and 'pg_%' in statement:
                raise ValueError('Literal SQL percent was treated as a binding placeholder')
        cursor.execute.side_effect=execute
        connection=MagicMock();connection.cursor.return_value.__enter__.return_value=cursor
        worker.query(connection, "SELECT schemaname FROM pg_tables WHERE schemaname NOT LIKE 'pg_%'")
    def test_dump_client_uses_named_database_instead_of_login_default(self):
        worker=self.load_worker()
        with patch.object(worker.subprocess,'run',return_value=types.SimpleNamespace(returncode=0,stdout=b'ok')) as child:
            worker.pg_tool('pg_dump',{'dbname':'tapkin_staging','password':'private','host':m.SOURCE_HOST},'--schema-only')
            self.assertEqual(child.call_args.kwargs['env']['PGDATABASE'],'tapkin_staging')
            self.assertNotIn('private',child.call_args.args[0])

if __name__=='__main__':unittest.main()
