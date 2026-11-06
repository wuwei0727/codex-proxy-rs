"""验证更新失败时不重建其他节点、不把故障节点恢复进流量池。"""
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from rolling_update import Updater, disabled_config


CONFIG = '''upstream cpr_cluster {
 server 127.0.0.1:18080 max_fails=2;
 server 127.0.0.1:18081 max_fails=2;
 keepalive 32;
}
'''


class RollingTests(unittest.TestCase):
    def updater(self):
        item = Updater('/unused', '/unused', drain=1, ready=1)
        item.healthy = Mock(return_value=True)
        item.workers = Mock(return_value={1: 'start'})
        item.configure = Mock()
        item.wait_drain = Mock()
        item.request_activity = Mock(return_value=None)
        item.recreate = Mock()
        return item

    def test_only_target_is_removed(self):
        result = disabled_config(CONFIG, 18081)
        self.assertIn('18080 max_fails=2;', result)
        self.assertIn('18081 max_fails=2 down;', result)
        self.assertIn('keepalive 32;', result)

    def test_existing_maintenance_or_ambiguous_config_rejected(self):
        for text in [CONFIG.replace('18081', '18080'), CONFIG.replace('max_fails=2;', 'down;'), CONFIG + CONFIG]:
            with self.assertRaises(RuntimeError):
                disabled_config(text, 18081)

    def test_drain_probe_failure_restores_routing_without_rebuild(self):
        item = self.updater()
        item.wait_drain.side_effect = RuntimeError('busy')
        with self.assertRaisesRegex(RuntimeError, 'busy'):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.recreate.assert_not_called()
        self.assertEqual(item.configure.call_args.args, (CONFIG,))

    def test_other_node_failure_stops_before_drain(self):
        item = self.updater()
        item.healthy.return_value = False
        with self.assertRaises(RuntimeError):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.configure.assert_not_called()
        item.recreate.assert_not_called()

    def test_rebuild_failure_leaves_node_out_of_rotation(self):
        item = self.updater()
        item.recreate.side_effect = RuntimeError('failed')
        with self.assertRaisesRegex(RuntimeError, 'failed'):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.configure.assert_called_once_with(disabled_config(CONFIG, 18081))

    def test_success_restores_only_after_version_verification(self):
        item = self.updater()
        item.container = Mock(return_value={'Id': 'cid', 'Image': 'image'})
        item.ready_timeout = 100
        with patch('rolling_update.run', return_value='3.41.0'), patch('rolling_update.time.sleep'):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.recreate.assert_called_once_with('node2', 'image')
        self.assertEqual(item.configure.call_args.args, (CONFIG,))

    def test_wrong_version_stays_drained(self):
        item = self.updater()
        item.container = Mock(return_value={'Id': 'cid', 'Image': 'image'})
        item.ready_timeout = 100
        with patch('rolling_update.run', return_value='bad'), patch('rolling_update.time.sleep'):
            with self.assertRaisesRegex(RuntimeError, '版本'):
                item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        self.assertEqual(item.configure.call_count, 1)

    def test_config_validation_failure_restores_original_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nginx.conf'
            path.write_text(CONFIG)
            item = Updater(directory, path)
            item.write_config = path.write_text
            with patch('rolling_update.run', side_effect=[RuntimeError('invalid'), '', '']):
                with self.assertRaisesRegex(RuntimeError, 'invalid'):
                    item.configure(disabled_config(CONFIG, 18081))
            self.assertEqual(path.read_text(), CONFIG)

    def test_target_connection_count_uses_only_destination_port(self):
        item = Updater('/unused', '/unused')
        with patch('rolling_update.run', return_value='0 0 127.0.0.1:40000 127.0.0.1:18081\n0 0 127.0.0.1:40001 127.0.0.1:18081') as command:
            self.assertEqual(item.target_connections(18081), 2)
        self.assertIn('dst 127.0.0.1 and dport = :18081', command.call_args.args)

    def test_empty_target_ignores_old_nginx_workers(self):
        item = Updater('/unused', '/unused')
        item.workers = Mock(return_value={1: 'start'})
        item.target_connections = Mock(return_value=0)
        self.assertEqual(item.wait_drain(18081), 0)
        item.workers.assert_not_called()

    def test_ss_failure_is_not_treated_as_empty(self):
        item = Updater('/unused', '/unused')
        with patch('rolling_update.run', side_effect=RuntimeError('ss failed')):
            with self.assertRaisesRegex(RuntimeError, 'ss failed'):
                item.wait_drain(18081)

    def test_connections_finish_before_deadline(self):
        item = Updater('/unused', '/unused')
        item.target_connections = Mock(side_effect=[2, 1, 0])
        with patch('rolling_update.time.sleep'):
            self.assertEqual(item.wait_drain(18081), 0)

    def test_connection_timeout_returns_remaining_without_killing_nginx(self):
        item = Updater('/unused', '/unused', drain=1)
        item.target_connections = Mock(return_value=2)
        with patch('rolling_update.time.monotonic', side_effect=[0, 2]):
            self.assertEqual(item.wait_drain(18081), 2)

    def test_timeout_continues_rebuild(self):
        item = self.updater()
        item.wait_drain.return_value = 2
        item.container = Mock(return_value={'Id': 'cid', 'Image': 'image'})
        item.ready_timeout = 100
        with patch('rolling_update.run', return_value='3.41.0'), patch('rolling_update.time.sleep'):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.wait_drain.assert_called_once_with(18081)
        item.recreate.assert_called_once_with('node2', 'image')

    def test_other_node_fails_during_drain(self):
        item = self.updater()
        item.healthy.side_effect = [True, False]
        with self.assertRaisesRegex(RuntimeError, '另一节点'):
            item.update_node('node2', 18081, 'image', '3.41.0', CONFIG)
        item.recreate.assert_not_called()
        self.assertEqual(item.configure.call_args.args, (CONFIG,))

    def test_external_config_change_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nginx.conf'
            path.write_text(CONFIG + '# external change')
            item = Updater(directory, path)
            item.expected_config = CONFIG
            with self.assertRaisesRegex(RuntimeError, '其他操作'):
                item.configure(disabled_config(CONFIG, 18081))
            self.assertEqual(path.read_text(), CONFIG + '# external change')

    def test_first_node_failure_never_updates_second(self):
        item = self.updater()
        item.preflight = Mock(return_value=CONFIG)
        item.container = Mock(return_value={'Image': 'old'})
        item.update_node = Mock(side_effect=RuntimeError('node2 failed'))
        config = '{"services":{"codex-proxy-rs":{"image":"latest"},"codex-proxy-rs-2":{"image":"latest"}}}'
        with patch('rolling_update.run', side_effect=['', config, 'new', 'new', '3.41.0']):
            with self.assertRaisesRegex(RuntimeError, 'node2 failed'):
                item.update()
        self.assertEqual(item.update_node.call_count, 1)
        self.assertEqual(item.update_node.call_args.args[0], 'codex-proxy-rs-2')

    def test_same_image_skips_both_nodes(self):
        item = self.updater()
        item.preflight = Mock(return_value=CONFIG)
        item.container = Mock(return_value={'Image': 'new'})
        item.update_node = Mock()
        config = '{"services":{"codex-proxy-rs":{"image":"latest"},"codex-proxy-rs-2":{"image":"latest"}}}'
        with patch('rolling_update.run', side_effect=['', config, 'new', 'new', '3.41.0']):
            item.update()
        item.update_node.assert_not_called()


    def test_idle_request_count_skips_tcp_wait(self):
        item = Updater('/unused', '/unused', drain=60)
        item.request_activity = Mock(return_value={'draining': True, 'activeRequests': 0})
        item.target_connections = Mock(side_effect=AssertionError('must not count idle sockets'))
        with patch('rolling_update.time.sleep') as sleep:
            self.assertEqual(item.wait_drain(18081, 'node2'), 0)
            sleep.assert_not_called()

    def test_request_drain_releases_when_stream_finishes(self):
        item = Updater('/unused', '/unused', drain=60)
        item.request_activity = Mock(side_effect=[
            {'draining': True, 'activeRequests': 1},
            {'draining': True, 'activeRequests': 0},
        ])
        with patch('rolling_update.time.sleep'):
            self.assertEqual(item.wait_drain(18081, 'node2'), 0)
        self.assertEqual(item.request_activity.call_count, 2)

    def test_request_probe_failure_resumes_admission_before_routing(self):
        item = self.updater()
        item.request_activity.side_effect = [
            {'draining': False, 'activeRequests': 1},
            {'draining': True, 'activeRequests': 1},
            {'draining': False, 'activeRequests': 1},
        ]
        item.wait_drain.side_effect = RuntimeError('probe failed')
        with self.assertRaisesRegex(RuntimeError, 'probe failed'):
            item.update_node('node2', 18081, 'image', 'version', CONFIG)
        self.assertEqual(item.request_activity.call_args.args, ('node2', 'DELETE'))
        self.assertEqual(item.configure.call_args.args, (CONFIG,))
        item.recreate.assert_not_called()

    def test_legacy_only_falls_back_on_explicit_missing_endpoint(self):
        item = Updater('/unused', '/unused')
        for response in ['not found\n404\ntext/plain', '<html>old</html>\n200\ntext/html', '\n404\n']:
            with patch('rolling_update.run', return_value=response + '\nCPR_DRAIN_END'):
                self.assertIsNone(item.request_activity('node2'))
        for response in ['bad\n500\ntext/plain', '{}\n200\napplication/json',
                         '{"draining":true,"activeRequests":true}\n200\napplication/json']:
            with patch('rolling_update.run', return_value=response + '\nCPR_DRAIN_END'):
                with self.assertRaises(RuntimeError):
                    item.request_activity('node2')


    def test_empty_legacy_body_preserves_curl_status_through_runner(self):
        item = Updater('/unused', '/unused')
        for output in ['\n404\n\nCPR_DRAIN_END', '\n404\ntext/plain\nCPR_DRAIN_END', 'not found\n404\n\nCPR_DRAIN_END']:
            result = subprocess.CompletedProcess([], 0, stdout=output, stderr='')
            with patch('rolling_update.subprocess.run', return_value=result):
                self.assertIsNone(item.request_activity('node2'))

    def test_failed_resume_keeps_target_out_of_rotation(self):
        item = self.updater()
        item.request_activity.side_effect = [
            {'draining': False, 'activeRequests': 1},
            {'draining': True, 'activeRequests': 1},
            RuntimeError('resume failed'),
        ]
        item.wait_drain.side_effect = RuntimeError('probe failed')
        with self.assertRaisesRegex(RuntimeError, 'resume failed'):
            item.update_node('node2', 18081, 'image', 'version', CONFIG)
        item.configure.assert_called_once_with(disabled_config(CONFIG, 18081))
        item.recreate.assert_not_called()

    def test_active_request_timeout_is_bounded(self):
        item = Updater('/unused', '/unused', drain=60)
        item.request_activity = Mock(return_value={'draining': True, 'activeRequests': 2})
        with patch('rolling_update.time.monotonic', side_effect=[0, 60]):
            self.assertEqual(item.wait_drain(18081, 'node2'), 2)


if __name__ == '__main__':
    unittest.main()
