import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

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
        with patch.object(m,'db_url',return_value=target),patch.object(m,'az',return_value=[] ) as cli,patch.object(m,'blob_read',return_value=b'wrong'),patch.object(m,'health') as health:
            with self.assertRaises(RuntimeError):m.retirement({'phase':'cutover-verified','backup':'private.dump','backupSha256':'mismatch'})
            health.assert_not_called()
            self.assertFalse(any('delete' in call.args for call in cli.call_args_list))

if __name__=='__main__':unittest.main()
