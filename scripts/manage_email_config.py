#!/usr/bin/env python3
"""
Email Configuration Encryption & Management Tool for DocForge

Encrypts and decrypts email configuration files using AES-256-GCM authenticated encryption.
"""

import sys
import os
import json
import base64
import hashlib
from typing import Dict, Any

# Cryptography imports (use standard hashlib + hmac / cryptography / pure python AES-GCM)
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

DEFAULT_SECRET_KEY = os.environ.get("EMAIL_CONFIG_SECRET", "docforge-email-secret-key-2026")
DEFAULT_CONFIG = {
    "smtp_server": "smtp.appunity.net",
    "smtp_port": 587,
    "secure": False,
    "email_account": "service@appunity.net",
    "from_address": "DocForge Security <service@appunity.net>",
    "password": ""
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "src", "backend", "config", "email_config.json")


def derive_key(secret: str) -> bytes:
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
        # In cryptography library, tag is last 16 bytes of ciphertext
        ciphertext = ciphertext_with_tag[:-16]
        tag = ciphertext_with_tag[-16:]
    else:
        # Fallback using node via subprocess or pure crypto if cryptography package is missing
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
            encrypted: true,
            algorithm: 'aes-256-gcm',
            iv: iv.toString('hex'),
            tag: tag.toString('hex'),
            data: enc.toString('hex')
        }}));
        """
        proc = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, check=True)
        return json.loads(proc.stdout.strip())

    return {
        "_comment": "DocForge Encrypted Email Configuration - Do not edit manually",
        "encrypted": True,
        "algorithm": "aes-256-gcm",
        "iv": iv.hex(),
        "tag": tag.hex(),
        "data": ciphertext.hex()
    }


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
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    if not os.path.isfile(config_path):
        print(f"[Email Config] No config found at {config_path}. Generating default encrypted config...")
        encrypted = encrypt_data(DEFAULT_CONFIG)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)
        print(f"[Email Config] Generated encrypted configuration at {config_path}")
        return

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data.get("encrypted") is True:
            print(f"[Email Config] Verified encrypted config at {config_path} (AES-256-GCM).")
        else:
            print(f"[Email Config] Encrypting plain config at {config_path}...")
            encrypted = encrypt_data(data)
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(encrypted, f, indent=2)
            print(f"[Email Config] Successfully encrypted {config_path}.")
    except Exception as e:
        print(f"[Email Config] Failed to parse {config_path}: {e}. Recreating default encrypted config...")
        encrypted = encrypt_data(DEFAULT_CONFIG)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)


def cmd_view(config_path: str = DEFAULT_CONFIG_PATH):
    if not os.path.isfile(config_path):
        print(f"Error: File not found at {config_path}")
        sys.exit(1)
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and data.get("encrypted") is True:
        dec = decrypt_data(data)
        print("--- Decrypted Email Configuration ---")
        print(json.dumps(dec, indent=2))
    else:
        print("--- Plain Email Configuration ---")
        print(json.dumps(data, indent=2))


def cmd_set_defaults(config_path: str = DEFAULT_CONFIG_PATH):
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    encrypted = encrypt_data(DEFAULT_CONFIG)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(encrypted, f, indent=2)
    print(f"[Email Config] Default configuration encrypted and written to {config_path}")


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "ensure-encrypted"
    target_path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_CONFIG_PATH

    if action in ("ensure-encrypted", "--ensure-encrypted"):
        cmd_ensure_encrypted(target_path)
    elif action in ("set-defaults", "--set-defaults"):
        cmd_set_defaults(target_path)
    elif action in ("view", "--view"):
        cmd_view(target_path)
    elif action in ("encrypt", "--encrypt"):
        if not os.path.isfile(target_path):
            print(f"Error: File not found {target_path}")
            sys.exit(1)
        with open(target_path, "r", encoding="utf-8") as f:
            plain = json.load(f)
        encrypted = encrypt_data(plain)
        out_path = sys.argv[3] if len(sys.argv) > 3 else target_path
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(encrypted, f, indent=2)
        print(f"Successfully encrypted {target_path} -> {out_path}")
    elif action in ("decrypt", "--decrypt"):
        if not os.path.isfile(target_path):
            print(f"Error: File not found {target_path}")
            sys.exit(1)
        with open(target_path, "r", encoding="utf-8") as f:
            envelope = json.load(f)
        decrypted = decrypt_data(envelope)
        out_path = sys.argv[3] if len(sys.argv) > 3 else target_path
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(decrypted, f, indent=2)
        print(f"Successfully decrypted {target_path} -> {out_path}")
    else:
        print(f"Unknown command: {action}")
        print("Usage: python3 scripts/manage_email_config.py [ensure-encrypted|set-defaults|view|encrypt|decrypt] [path]")
        sys.exit(1)


if __name__ == "__main__":
    main()
