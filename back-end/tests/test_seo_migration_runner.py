import contextlib
import importlib.util
import io
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch


script = Path(__file__).resolve().parents[1] / "scripts/apply_seo_migration.py"
spec = importlib.util.spec_from_file_location("seo_migration_runner", script)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class MigrationRunnerTests(unittest.TestCase):
    def run_script(self, args, engine):
        with patch('sys.argv', ['apply_seo_migration.py', *args]), \
             patch.dict('sys.modules', {'config': SimpleNamespace(engine=engine)}), \
             contextlib.redirect_stdout(io.StringIO()):
            runner.main()

    def test_dry_run_never_connects(self):
        engine = MagicMock()
        self.run_script([], engine)
        engine.raw_connection.assert_not_called()

    def test_apply_runs_versioned_atomic_sql_and_restores_pool_connection(self):
        engine = MagicMock()
        engine.dialect.name = 'postgresql'
        connection = engine.raw_connection.return_value
        driver = connection.driver_connection
        driver.autocommit = False
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.execute.side_effect = lambda sql: self.assertTrue(driver.autocommit)
        self.run_script(['--apply'], engine)
        sql = cursor.execute.call_args.args[0]
        self.assertIn('BEGIN;', sql)
        self.assertIn('CREATE TRIGGER product_public_updated_at', sql)
        self.assertIn('COMMIT;', sql)
        self.assertFalse(driver.autocommit)
        connection.close.assert_called_once()

    def test_failure_rolls_back_and_closes_without_hiding_sql_error(self):
        engine = MagicMock()
        engine.dialect.name = 'postgresql'
        connection = engine.raw_connection.return_value
        driver = connection.driver_connection
        driver.autocommit = False
        connection.cursor.return_value.__enter__.return_value.execute.side_effect = RuntimeError('SQL failed')
        with self.assertRaisesRegex(RuntimeError, 'SQL failed'):
            self.run_script(['--apply'], engine)
        driver.rollback.assert_called_once()
        self.assertFalse(driver.autocommit)
        connection.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
