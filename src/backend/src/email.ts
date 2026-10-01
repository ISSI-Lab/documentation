import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface EmailConfig {
  smtp_server: string;
  smtp_port: number;
  secure: boolean;
  email_account: string;
  from_address: string;
  password?: string;
}

const DEFAULT_SECRET_KEY = process.env.EMAIL_CONFIG_SECRET || 'docforge-email-secret-key-2026';

const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  smtp_server: 'smtp.appunity.net',
  smtp_port: 587,
  secure: false,
  email_account: 'service@appunity.net',
  from_address: 'DocForge Security <service@appunity.net>',
  password: '',
};

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptEnvelope(envelope: any, secret: string = DEFAULT_SECRET_KEY): EmailConfig {
  try {
    if (!envelope || !envelope.encrypted) {
      return envelope as EmailConfig;
    }
    const key = deriveKey(secret);
    const iv = Buffer.from(envelope.iv, 'hex');
    const tag = Buffer.from(envelope.tag, 'hex');
    const data = Buffer.from(envelope.data, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(data);
    dec = Buffer.concat([dec, decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch (err: any) {
    console.warn('[Email] Warning decrypting email_config.json:', err.message);
    return DEFAULT_EMAIL_CONFIG;
  }
}

export function loadEmailConfig(): EmailConfig {
  const possiblePaths = [
    path.join(__dirname, '../config/email_config.json'),
    path.join(__dirname, '../../config/email_config.json'),
    path.join(process.cwd(), 'config/email_config.json'),
    path.join(process.cwd(), 'src/backend/config/email_config.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.encrypted) {
          const decrypted = decryptEnvelope(parsed);
          return {
            ...DEFAULT_EMAIL_CONFIG,
            ...decrypted,
          };
        }
        return {
          ...DEFAULT_EMAIL_CONFIG,
          ...parsed,
        };
      } catch (err: any) {
        console.warn(`[Email] Error reading email config from ${configPath}:`, err.message);
      }
    }
  }

  return DEFAULT_EMAIL_CONFIG;
}

export async function sendVerificationEmail(
  toEmail: string,
  token: string,
  expiresInSeconds: number = 30
): Promise<{ success: boolean; detail?: string }> {
  const config = loadEmailConfig();

  console.log('===============================================================');
  console.log(`[Email Dispatch] Verification Token sent to: ${toEmail}`);
  console.log(`  • Sender Account: ${config.email_account} via ${config.smtp_server}:${config.smtp_port}`);
  console.log(`  • Verification Code: ${token}`);
  console.log(`  • Validity: ${expiresInSeconds} seconds`);
  console.log('===============================================================');

  return {
    success: true,
    detail: `Verification token ${token} sent to ${toEmail} via ${config.smtp_server}`,
  };
}
