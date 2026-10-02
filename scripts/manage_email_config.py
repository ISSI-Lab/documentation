#!/usr/bin/env python3
"""
Email Configuration Encryption & Management Tool for DocForge

Encrypts and decrypts email configuration files using AES-256-GCM authenticated encryption.
Provides interactive setup CLI wizard for configuring SMTP email credentials.
"""

import sys
import os
import json
import base64
import hashlib
import getpass
from typing import Dict, Any

# Cryptography imports (use standard hashlib + hmac / cryptography / pure python AES-GCM)
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "src", "backend", "config", "email_config.json")


def load_env_file():
    """Load environment variables from .env file if available."""
    env_path = os.path.join(PROJECT_ROOT, ".env")
    if os.path.isfile(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass


load_env_file()

DEFAULT_SECRET_KEY = os.environ.get("EMAIL_CONFIG_SECRET", "docforge-email-secret-key-2026")
DEFAULT_CONFIG = {
    "smtp_server": "smtp.appunity.net",
    "smtp_port": 587,
    "secure": False,
    "email_account": "service@appunity.net",
    "from_address": "DocForge Security <service@appunity.net>",
    "password": ""
}


def derive_key(secret: str = DEFAULT_SECRET_KEY) -> bytes:
    """Derive a 32-byte key from secret string using SHA-256."""
    return hashlib.sha256(secret.encode("utf-8")).digest()


def encrypt_data(data_dict: Dict[str, Any], secret: str = DEFAULT_SECRET_KEY) -> Dict[str, Any]:
    """Encrypt a dictionary into an AES-256-GCM envelope."""
    key = derive_key(secret)
    json_bytes = json.dumps(data_dict, indent=2).encode("utf-8")

    if HAS_CRYPTOGRAPHY:
        aesgcm = AESGCM(key)
        iv = os.urandom(12)  # 96-bit nonce
        ciphertext_with_tag = aesgcm.encrypt(iv, json_bytes, None)
        ciphertext = ciphertext_with_tag[:-16]
        tag = ciphertext_with_tag[-16:]
        return {
            "_comment": "DocForge Encrypted Email Configuration - Do not edit manually",
            "encrypted": True,
            "algorithm": "aes-256-gcm",
            "iv": iv.hex(),
            "tag": tag.hex(),
            "data": ciphertext.hex()
        }
    else:
        # Fallback using Node.js crypto
        import subprocess
        node_script = f"""
        const crypto = require('crypto');
        const key = crypto.createHash('sha256').update({json.dumps(secret)}).digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const plaintext = Buffer.from({json.dumps(json.dumps(data_dict))}, 'utf8');
        let enc = cipher.update(plaintext);
        enc = Buffer.concat([enc, cipher.final()]);
        const tag = cipher.getAuthTag();
        console.log(JSON.stringify({{
            _comment: 'DocForge Encrypted Email Configuration - Do not edit manually',
            encrypted: true,
            algorithm: 'aes-256-gcm',
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
            data: enc.toString('hex')
        }}));
        """
        proc = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, check=True)
        return json.loads(proc.stdout.strip())


def decrypt_data(envelope: Dict[str, Any], secret: str = DEFAULT_SECRET_KEY) -> Dict[str, Any]:
    """Decrypt an AES-256-GCM envelope dictionary into original config dictionary."""
    if not envelope.get("encrypted"):
        return envelope

    key = derive_key(secret)
    iv = bytes.fromhex(envelope["iv"])
    tag = bytes.fromhex(envelope["tag"])
    ciphertext = bytes.fromhex(envelope["data"])

    if HAS_CRYPTOGRAPHY:
        aesgcm = AESGCM(key)
        ciphertext_with_tag = ciphertext + tag
        decrypted_bytes = aesgcm.decrypt(iv, ciphertext_with_tag, None)
        return json.loads(decrypted_bytes.decode("utf-8"))
    else:
        import subprocess
        node_script = f"""
        const crypto = require('crypto');
        const key = crypto.createHash('sha256').update({json.dumps(secret)}).digest();
        const iv = Buffer.from('{envelope["iv"]}', 'hex');
        const tag = Buffer.from('{envelope["tag"]}', 'hex');
        const data = Buffer.from('{envelope["data"]}', 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        console.log(dec.toString('utf8'));
        """
        proc = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, check=True)
        return json.loads(proc.stdout.strip())


def is_encrypted_file(path: str) -> bool:
    if not os.path.isfile(path):
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return isinstance(data, dict) and data.get("encrypted") is True
    except Exception:
        return False


def cmd_ensure_encrypted(config_path: str = DEFAULT_CONFIG_PATH):
    """Ensure email configuration file exists and is encrypted."""
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    if not os.path.isfile(config_path):
        print(f"[Email Config] No config found at {config_path}. Generating default encrypted config...")
        encrypted = encrypt_data(DEFAULT_CONFIG)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)
        os.chmod(config_path, 0o600)
        print(f"[Email Config] Generated default encrypted configuration at {config_path}")
        return

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("encrypted") is True:
            # File is already encrypted
            pass
        else:
            print(f"[Email Config] Encrypting plain config at {config_path}...")
            encrypted = encrypt_data(data)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(encrypted, f, indent=2)
            os.chmod(config_path, 0o600)
            print(f"[Email Config] Successfully encrypted {config_path}.")
    except Exception as e:
        print(f"[Email Config] Failed to parse {config_path}: {e}. Recreating default encrypted config...")
        encrypted = encrypt_data(DEFAULT_CONFIG)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)
        os.chmod(config_path, 0o600)


def cmd_view(config_path: str = DEFAULT_CONFIG_PATH):
    """View decrypted configuration with password masked."""
    if not os.path.isfile(config_path):
        print(f"Error: File not found at {config_path}")
        sys.exit(1)
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and data.get("encrypted") is True:
        dec = decrypt_data(data)
        masked = dict(dec)
        if masked.get("password"):
            masked["password"] = "********"
        print("--- Decrypted Email Configuration ---")
        print(json.dumps(masked, indent=2))
    else:
        print("--- Plain Email Configuration ---")
        print(json.dumps(data, indent=2))


def cmd_status(config_path: str = DEFAULT_CONFIG_PATH):
    """Output clean single-line status for startup script."""
    if not os.path.isfile(config_path):
        print("[Email Service] No configuration found (run ./scripts/setup_email.sh to configure)")
        return
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        cfg = decrypt_data(data) if data.get("encrypted") else data
        server = cfg.get("smtp_server", "not set")
        port = cfg.get("smtp_port", 587)
        account = cfg.get("email_account", "not set")
        has_pass = "Active / Encrypted" if cfg.get("password") else "Unset (Console Logging Mode)"
        print(f"✓ [Email Service] Server: {server}:{port} | Account: {account} | Password: {has_pass}")
    except Exception as e:
        print(f"[Email Service] Error reading configuration: {e}")


def cmd_test(config_path: str = DEFAULT_CONFIG_PATH, recipient: str = None):
    """Test live connection with the configured SMTP server."""
    if not os.path.isfile(config_path):
        print(f"Error: Configuration file not found at {config_path}")
        return False

    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    cfg = decrypt_data(data) if data.get("encrypted") else data

    host = cfg.get("smtp_server")
    port = int(cfg.get("smtp_port", 587))
    secure = bool(cfg.get("secure", False))
    user = cfg.get("email_account")
    password = cfg.get("password", "")
    from_addr = cfg.get("from_address") or user

    print(f"==> Connecting to SMTP server {host}:{port} (Direct SSL: {secure})...")

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    try:
        if secure or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            try:
                server.starttls()
                server.ehlo()
            except Exception:
                pass

        if user and password:
            server.login(user, password)
            print(f"✓ SMTP Authentication successful for {user}!")
        else:
            print("✓ Connected to SMTP server (No password configured).")

        if recipient:
            print(f"==> Sending test verification email to {recipient}...")
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "[DocForge] SMTP Verification Test Email"
            msg["From"] = from_addr
            msg["To"] = recipient

            text = f"Hello,\n\nThis email confirms that your DocForge SMTP email configuration is active!\nHost: {host}:{port}\nSender: {from_addr}\nAccount: {user}\n"
            msg.attach(MIMEText(text, "plain"))

            server.sendmail(from_addr, [recipient], msg.as_string())
            print(f"✓ Test email successfully delivered to {recipient}!")

        server.quit()
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"⚠️  SMTP Authentication Failed: {e}")
        print("\n🔍 Diagnosis & Solutions:")
        if "gmail" in str(host).lower():
            print("  • Gmail Account: You MUST use a 16-character Google 'App Password', not your standard account password.")
            print("    Generate one at: https://myaccount.google.com/apppasswords (requires 2-Step Verification enabled).")
        elif "office365" in str(host).lower() or "outlook" in str(host).lower():
            print("  • Microsoft 365 / Outlook: Ensure 'Authenticated SMTP' is enabled for this mailbox in the M365 Admin Portal.")
        else:
            print(f"  • Verify your username ({user}) and password are correct without trailing spaces.")
        return False
    except smtplib.SMTPSenderRefused as e:
        print(f"⚠️  Sender Address Refused: {e}")
        print("\n🔍 Diagnosis:")
        print(f"  • Your SMTP server rejected the From address: '{from_addr}'.")
        print(f"  • Ensure the Sender/From address exactly matches your authenticated email account ({user}) or a verified domain.")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        print(f"⚠️  Recipient Address Refused: {e}")
        print("\n🔍 Diagnosis:")
        print(f"  • The SMTP server rejected the recipient address: '{recipient}'.")
        return False
    except TimeoutError:
        print(f"⚠️  Connection Timeout: Unable to reach {host}:{port} within 10 seconds.")
        print("\n🔍 Diagnosis:")
        print(f"  • Your ISP or network firewall may be blocking outbound traffic on port {port}.")
        print("  • Try switching ports: use 587 (STARTTLS) or 465 (Direct SSL).")
        return False
    except Exception as e:
        err_str = str(e)
        print(f"⚠️  SMTP Connection or Authentication failed: {e}")
        print("\n🔍 Diagnosis & Common Causes:")
        if "nodename nor servname provided" in err_str or "getaddrinfo failed" in err_str:
            print(f"  • Invalid Hostname: Could not resolve '{host}'.")
            print("    Ensure you are using a real, reachable SMTP server (e.g. smtp.gmail.com) instead of the default placeholder.")
        elif "WRONG_VERSION_NUMBER" in err_str or "unknown protocol" in err_str:
            print(f"  • Protocol Mismatch: Port {port} does not match the SSL setting.")
            print("    Port 587 requires STARTTLS (Direct SSL: False). Port 465 requires Direct SSL (Direct SSL: True).")
        elif "Connection refused" in err_str:
            print(f"  • Connection Refused: No SMTP server listening on {host}:{port}.")
        else:
            print(f"  • Check hostname ({host}), port ({port}), security mode, and network connectivity.")
        return False


def cmd_setup(config_path: str = DEFAULT_CONFIG_PATH, args: list = None):
    """Interactive command-line wizard or flag-based updater for email configuration."""
    args = args or []

    # Check for non-interactive flags
    flag_server = None
    flag_port = None
    flag_account = None
    flag_pass = None
    flag_secure = None
    flag_from = None
    flag_test_recip = None
    is_non_interactive = False

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("--server", "--host") and i + 1 < len(args):
            flag_server = args[i + 1]
            i += 2
        elif arg == "--port" and i + 1 < len(args):
            flag_port = int(args[i + 1])
            i += 2
        elif arg in ("--account", "--user") and i + 1 < len(args):
            flag_account = args[i + 1]
            i += 2
        elif arg in ("--password", "--pass") and i + 1 < len(args):
            flag_pass = args[i + 1]
            i += 2
        elif arg == "--from-address" and i + 1 < len(args):
            flag_from = args[i + 1]
            i += 2
        elif arg == "--secure" and i + 1 < len(args):
            flag_secure = args[i + 1].lower() in ("true", "1", "yes")
            i += 2
        elif arg == "--test" and i + 1 < len(args):
            flag_test_recip = args[i + 1]
            i += 2
        elif arg == "--non-interactive":
            is_non_interactive = True
            i += 1
        else:
            i += 1

    # Load existing configuration
    current = {}
    if os.path.isfile(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            current = decrypt_data(data) if data.get("encrypted") else data
        except Exception:
            current = {}

    smtp_server = flag_server or current.get("smtp_server") or DEFAULT_CONFIG["smtp_server"]
    smtp_port = flag_port or current.get("smtp_port") or DEFAULT_CONFIG["smtp_port"]
    secure = flag_secure if flag_secure is not None else current.get("secure", DEFAULT_CONFIG["secure"])
    email_account = flag_account or current.get("email_account") or DEFAULT_CONFIG["email_account"]
    from_address = flag_from or current.get("from_address") or DEFAULT_CONFIG["from_address"]
    existing_password = current.get("password") or ""
    password = flag_pass if flag_pass is not None else existing_password

    if not is_non_interactive:
        print("================================================================")
        print("           DocForge SMTP Email Configuration Wizard             ")
        print("================================================================")
        print(f"Target Configuration: {config_path}")
        print("Credentials will be encrypted with AES-256-GCM using EMAIL_CONFIG_SECRET.")
        print("")

        if existing_password:
            print("Current Saved Configuration:")
            print(f"  • Host:     {smtp_server}:{smtp_port} (SSL: {secure})")
            print(f"  • Account:  {email_account}")
            print(f"  • Sender:   {from_address}")
            print("  • Password: [Encrypted & Saved]")
            print("")

        try:
            val = input(f"1. SMTP Server Host [{smtp_server}]: ").strip()
            if val:
                smtp_server = val

            val = input(f"2. SMTP Server Port (587 for STARTTLS, 465 for SSL) [{smtp_port}]: ").strip()
            if val:
                smtp_port = int(val)

            def_sec = "y" if secure or smtp_port == 465 else "n"
            val = input(f"3. Use direct SSL/TLS? (y/n) [{def_sec}]: ").strip().lower()
            if val in ("y", "yes"):
                secure = True
            elif val in ("n", "no"):
                secure = False
            else:
                secure = (def_sec == "y")

            val = input(f"4. Email Account / Username [{email_account}]: ").strip()
            if val:
                email_account = val

            if existing_password:
                val = getpass.getpass("5. SMTP Password (press Enter to keep existing password): ").strip()
                if val:
                    password = val
            else:
                password = getpass.getpass("5. SMTP Password / App Secret: ").strip()

            def_from = from_address or f"DocForge Security <{email_account}>"
            val = input(f"6. Sender / From Address [{def_from}]: ").strip()
            if val:
                from_address = val
            else:
                from_address = def_from

        except (KeyboardInterrupt, EOFError):
            print("\nSetup cancelled.")
            sys.exit(0)

    updated_config = {
        "smtp_server": smtp_server,
        "smtp_port": int(smtp_port),
        "secure": bool(secure),
        "email_account": email_account,
        "from_address": from_address,
        "password": password
    }

    # Encrypt and save
    encrypted = encrypt_data(updated_config)
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(encrypted, f, indent=2)
    os.chmod(config_path, 0o600)

    print("")
    print("================================================================")
    print("✓ Email configuration successfully encrypted & saved!")
    print("================================================================")
    print(f"  • File:     {config_path} (Permissions: 0600)")
    print(f"  • Host:     {smtp_server}:{smtp_port}")
    print(f"  • Account:  {email_account}")
    print(f"  • Sender:   {from_address}")
    print(f"  • Security: {'Direct SSL/TLS' if secure else 'STARTTLS'}")
    print(f"  • Password: {'[Saved & Encrypted with AES-256-GCM]' if password else '[Unset - Console Dev Mode]'}")
    print("")

    if not is_non_interactive and sys.stdin.isatty():
        try:
            ans = input("Would you like to test the SMTP connection now? [y/N]: ").strip().lower()
            if ans in ("y", "yes"):
                recip = input("Enter recipient email address (or press Enter to verify handshake only): ").strip()
                cmd_test(config_path, recipient=recip or None)
        except (KeyboardInterrupt, EOFError):
            pass
    elif flag_test_recip:
        cmd_test(config_path, recipient=flag_test_recip)

    print("")
    print("Next step:")
    print("  Run ./scripts/start.sh to start the platform.")
    print("  The application will automatically load and decrypt email_config.json.")
    print("")


def cmd_set_defaults(config_path: str = DEFAULT_CONFIG_PATH):
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    encrypted = encrypt_data(DEFAULT_CONFIG)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(encrypted, f, indent=2)
    os.chmod(config_path, 0o600)
    print(f"[Email Config] Default configuration encrypted and written to {config_path}")


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "ensure-encrypted"
    target_path = DEFAULT_CONFIG_PATH

    if action in ("setup", "--setup", "configure"):
        cmd_setup(target_path, sys.argv[2:])
    elif action in ("ensure-encrypted", "--ensure-encrypted"):
        cmd_ensure_encrypted(target_path)
    elif action in ("status", "--status"):
        cmd_status(target_path)
    elif action in ("test", "--test"):
        recipient = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_test(target_path, recipient)
    elif action in ("set-defaults", "--set-defaults"):
        cmd_set_defaults(target_path)
    elif action in ("view", "--view"):
        cmd_view(target_path)
    elif action in ("encrypt", "--encrypt"):
        in_path = sys.argv[2] if len(sys.argv) > 2 else target_path
        if not os.path.isfile(in_path):
            print(f"Error: File not found {in_path}")
            sys.exit(1)
        with open(in_path, "r", encoding="utf-8") as f:
            plain = json.load(f)
        encrypted = encrypt_data(plain)
        out_path = sys.argv[3] if len(sys.argv) > 3 else in_path
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)
        os.chmod(out_path, 0o600)
        print(f"Successfully encrypted {in_path} -> {out_path}")
    elif action in ("decrypt", "--decrypt"):
        in_path = sys.argv[2] if len(sys.argv) > 2 else target_path
        if not os.path.isfile(in_path):
            print(f"Error: File not found {in_path}")
            sys.exit(1)
        with open(in_path, "r", encoding="utf-8") as f:
            envelope = json.load(f)
        decrypted = decrypt_data(envelope)
        out_path = sys.argv[3] if len(sys.argv) > 3 else in_path
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(decrypted, f, indent=2)
        print(f"Successfully decrypted {in_path} -> {out_path}")
    else:
        print(f"Unknown command: {action}")
        print("Usage: python3 scripts/manage_email_config.py [setup|ensure-encrypted|status|test|view|encrypt|decrypt]")
        sys.exit(1)


if __name__ == "__main__":
    main()
