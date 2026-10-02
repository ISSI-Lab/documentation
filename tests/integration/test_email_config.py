"""Integration tests for email configuration management and encryption."""

import json
import os
import stat
import subprocess
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONFIG_PATH = os.path.join(REPO_ROOT, "src", "backend", "config", "email_config.json")
MANAGE_SCRIPT = os.path.join(REPO_ROOT, "scripts", "manage_email_config.py")


class TestEmailConfiguration(unittest.TestCase):

    def test_default_key_and_ensure_encrypted(self):
        """Test that manage_email_config.py ensures configuration is encrypted using default key."""
        res = subprocess.run(
            ["python3", MANAGE_SCRIPT, "ensure-encrypted"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        self.assertTrue(os.path.isfile(CONFIG_PATH))

        # Check permissions (0600)
        mode = stat.S_IMODE(os.stat(CONFIG_PATH).st_mode)
        self.assertEqual(mode & (stat.S_IRWXG | stat.S_IRWXO), 0)

        # Check file structure
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertTrue(data.get("encrypted"))
        self.assertEqual(data.get("algorithm"), "aes-256-gcm")
        self.assertIn("iv", data)
        self.assertIn("tag", data)
        self.assertIn("data", data)

    def test_cli_setup_and_decryption(self):
        """Test updating email config via CLI flags and verifying decrypted content."""
        subprocess.run(
            [
                "python3", MANAGE_SCRIPT, "setup",
                "--server", "smtp.customtest.org",
                "--port", "465",
                "--secure", "true",
                "--account", "testuser@customtest.org",
                "--password", "MyP@ssw0rd!2026",
                "--from-address", "Test System <testuser@customtest.org>",
                "--non-interactive"
            ],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True
        )

        # Verify decrypted content via python
        res = subprocess.run(
            ["python3", MANAGE_SCRIPT, "view"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        self.assertIn("smtp.customtest.org", res.stdout)
        self.assertIn("testuser@customtest.org", res.stdout)
        self.assertIn("465", res.stdout)

        # Verify backend Node.js deciphers the exact same config
        backend_email = os.path.join(REPO_ROOT, "src", "backend", "dist", "email.js")
        if os.path.isfile(backend_email):
            node_script = f"""
            const {{ loadEmailConfig }} = require('{backend_email}');
            const cfg = loadEmailConfig();
            console.log(JSON.stringify(cfg));
            """
            node_res = subprocess.run(
                ["node", "-e", node_script],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                check=True
            )
            cfg = json.loads(node_res.stdout.strip())
            self.assertEqual(cfg["smtp_server"], "smtp.customtest.org")
            self.assertEqual(cfg["smtp_port"], 465)
            self.assertEqual(cfg["secure"], True)
            self.assertEqual(cfg["email_account"], "testuser@customtest.org")
            self.assertEqual(cfg["password"], "MyP@ssw0rd!2026")


if __name__ == "__main__":
    unittest.main()
