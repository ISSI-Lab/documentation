import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import nodemailer, { Transporter } from 'nodemailer';

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
    '/app/config/email_config.json',
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

export function createTransporter(config: EmailConfig = loadEmailConfig()): Transporter | null {
  if (!config.smtp_server || !config.email_account) {
    return null;
  }

  const isPort465 = config.smtp_port === 465;
  const isSecure = config.secure !== undefined ? config.secure : isPort465;

  return nodemailer.createTransport({
    host: config.smtp_server,
    port: config.smtp_port,
    secure: isSecure,
    auth: config.password
      ? {
          user: config.email_account,
          pass: config.password,
        }
      : undefined,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
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

  // If password and SMTP server are configured, attempt real email transmission
  if (config.password && config.smtp_server) {
    try {
      const transporter = createTransporter(config);
      if (transporter) {
        const fromHeader = config.from_address || `"DocForge Security" <${config.email_account}>`;
        const info = await transporter.sendMail({
          from: fromHeader,
          to: toEmail,
          subject: `[DocForge] Verification Code: ${token}`,
          text: `Welcome to DocForge!\n\nYour account verification code is: ${token}\nThis code will expire in ${expiresInSeconds} seconds.\n\nIf you did not initiate this registration, please ignore this email.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Welcome to DocForge</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.5;">
                Thank you for creating an account. Please use the following 6-digit verification code to activate your account:
              </p>
              <div style="background-color: #f1f5f9; text-align: center; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <span style="font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #2563eb;">${token}</span>
              </div>
              <p style="color: #64748b; font-size: 13px;">
                This code will expire in <strong>${expiresInSeconds} seconds</strong>.
              </p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                Sent by ${config.from_address || config.email_account}.
              </p>
            </div>
          `,
        });
        console.log(`[Email Dispatch] Email successfully delivered to ${toEmail}. Message ID: ${info.messageId}`);
        return {
          success: true,
          detail: `Verification token delivered via SMTP to ${toEmail} (ID: ${info.messageId})`,
        };
      }
    } catch (err: any) {
      console.warn(`[Email Dispatch] SMTP Delivery Notice: ${err.message}. Verification token remains active in console.`);
    }
  }

  return {
    success: true,
    detail: `Verification token ${token} sent to ${toEmail} (Console/Development mode)`,
  };
}
