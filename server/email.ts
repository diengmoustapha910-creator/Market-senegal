import nodemailer, { type TestAccount, type Transporter } from 'nodemailer';

export interface EmailConfigStatus {
  configured: boolean;
  missingVars: string[];
  provider: string;
  host?: string;
  from: string;
  mode: 'production' | 'sandbox';
}

/**
 * Checks whether transactional email credentials (SMTP) are configured on the server.
 * Uses exact required names: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
 * Differentiates production mode from development sandbox.
 */
export function checkEmailConfig(): EmailConfigStatus {
  const isProduction = process.env.NODE_ENV === 'production';
  const mode: 'production' | 'sandbox' = (process.env.EMAIL_MODE || (isProduction ? 'production' : 'sandbox')).toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  const port = process.env.SMTP_PORT?.trim() || '587';
  const from = process.env.SMTP_FROM?.trim() || 'contact@marketsenegal.sn';

  const missingVars: string[] = [];
  if (!host) missingVars.push('SMTP_HOST');
  if (!user) missingVars.push('SMTP_USER');
  if (!password) missingVars.push('SMTP_PASSWORD');

  const configured = missingVars.length === 0;

  return {
    configured,
    missingVars,
    provider: host ? `SMTP (${host}:${port})` : mode === 'sandbox' ? 'Bac à sable (Sandbox de test)' : 'SMTP (Non configuré)',
    host,
    from,
    mode,
  };
}

export interface SendEmailResult {
  sent: boolean;
  configured: boolean;
  mode: 'production' | 'sandbox';
  reason?: string;
  missingVars?: string[];
  messageId?: string;
  sandboxPreviewUrl?: string;
}

let cachedTestAccount: TestAccount | null = null;

async function getTransporter(): Promise<{
  transporter: Transporter;
  mode: 'production' | 'sandbox';
  from: string;
}> {
  const config = checkEmailConfig();

  // If in production mode or if real SMTP credentials are provided:
  if (config.mode === 'production' || config.configured) {
    if (!config.configured) {
      throw new Error(`Fournisseur SMTP incomplet en production (variables manquantes : ${config.missingVars.join(', ')}).`);
    }

    const port = Number(process.env.SMTP_PORT) || 587;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      },
    });

    return { transporter, mode: 'production', from: config.from };
  }

  // Development sandbox mode: use Ethereal test inbox so NO real emails are mistakenly dispatched
  if (!cachedTestAccount) {
    try {
      cachedTestAccount = await nodemailer.createTestAccount();
    } catch {
      // Fallback in case ethereal is temporarily unreachable
      cachedTestAccount = {
        user: 'sandbox@marketsenegal.local',
        pass: 'sandbox-pass',
        smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
        imap: { host: 'imap.ethereal.email', port: 993, secure: true },
        pop3: { host: 'pop3.ethereal.email', port: 995, secure: true },
        web: 'https://ethereal.email'
      };
    }
  }

  const transporter = nodemailer.createTransport({
    host: cachedTestAccount.smtp.host,
    port: cachedTestAccount.smtp.port,
    secure: cachedTestAccount.smtp.secure,
    auth: {
      user: cachedTestAccount.user,
      pass: cachedTestAccount.pass,
    },
  });

  return { transporter, mode: 'sandbox', from: config.from };
}

/**
 * Sends a password reset email.
 * - In production: uses real SMTP and sends only after true confirmation.
 * - In development sandbox: traps email in Ethereal test sandbox and generates preview URL.
 */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  token: string;
  role: string;
  userName?: string;
}): Promise<SendEmailResult> {
  const config = checkEmailConfig();

  if (config.mode === 'production' && !config.configured) {
    const reason = `Fournisseur d'e-mails non configuré sur le serveur Cloud Run (variables manquantes : ${config.missingVars.join(', ')}). Les e-mails de réinitialisation ne fonctionneront pas en production tant que le SMTP n'est pas renseigné.`;
    console.warn(`[Email Service Production] ${reason}`);
    return {
      sent: false,
      configured: false,
      mode: 'production',
      reason,
      missingVars: config.missingVars,
    };
  }

  try {
    const { transporter, mode, from } = await getTransporter();

    const isHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px;">MARKET SÉNÉGAL</h2>
          <p style="color: #ea580c; font-size: 13px; font-weight: bold; margin: 4px 0 0 0;">Le grand marché en ligne du Sénégal</p>
        </div>
        
        <div style="color: #334155; font-size: 14px; line-height: 1.6;">
          <p>Bonjour ${params.userName ? `<strong>${params.userName}</strong>` : ''},</p>
          <p>Une demande de réinitialisation de mot de passe a été initiée pour votre compte MARKET SÉNÉGAL.</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.resetUrl}" style="background-color: #ea580c; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 12px; display: inline-block;">
              Réinitialiser mon mot de passe
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            Ce lien est à <strong>usage unique</strong> et expirera automatiquement dans <strong>30 minutes</strong>.
          </p>
          <p style="font-size: 12px; color: #64748b;">
            Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail : votre mot de passe actuel reste inchangé.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          MARKET SÉNÉGAL · Plateforme e-commerce sécurisée
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"MARKET SÉNÉGAL" <${from}>`,
      to: params.to,
      subject: 'Réinitialisation sécurisée de votre mot de passe - MARKET SÉNÉGAL',
      text: `Bonjour,\n\nPour réinitialiser votre mot de passe MARKET SÉNÉGAL, rendez-vous sur le lien suivant (valable 30 minutes, usage unique) :\n${params.resetUrl}\n\nSi vous n'avez pas demandé cette réinitialisation, veuillez ignorer ce message.`,
      html: isHtml,
    });

    let previewUrl: string | undefined;
    if (mode === 'sandbox') {
      const etherealUrl = nodemailer.getTestMessageUrl(info);
      if (etherealUrl) {
        previewUrl = etherealUrl;
        console.log(`[Email Sandbox] Aperçu de l'e-mail capturé : ${previewUrl}`);
      }
    }

    return {
      sent: true,
      configured: true,
      mode,
      messageId: info.messageId,
      sandboxPreviewUrl: previewUrl,
    };
  } catch (err: any) {
    console.error('[Email Service] Échec d’envoi e-mail SMTP:', err);
    return {
      sent: false,
      configured: true,
      mode: config.mode,
      reason: `Erreur d'envoi SMTP : ${err.message || 'Impossible de joindre le serveur SMTP.'}`,
    };
  }
}

/**
 * Sends an email address verification message to a new or unverified client.
 */
export async function sendVerificationEmail(params: {
  to: string;
  verifyUrl: string;
  userName?: string;
}): Promise<SendEmailResult> {
  const config = checkEmailConfig();

  if (config.mode === 'production' && !config.configured) {
    return {
      sent: false,
      configured: false,
      mode: 'production',
      reason: 'Fournisseur SMTP non configuré en production pour les e-mails de vérification.',
      missingVars: config.missingVars,
    };
  }

  try {
    const { transporter, mode, from } = await getTransporter();

    const isHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px;">MARKET SÉNÉGAL</h2>
          <p style="color: #ea580c; font-size: 13px; font-weight: bold; margin: 4px 0 0 0;">Le grand marché en ligne du Sénégal</p>
        </div>
        
        <div style="color: #334155; font-size: 14px; line-height: 1.6;">
          <p>Bonjour ${params.userName ? `<strong>${params.userName}</strong>` : ''},</p>
          <p>Merci pour votre inscription sur MARKET SÉNÉGAL. Pour finaliser la sécurité de votre compte client, veuillez confirmer votre adresse e-mail :</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${params.verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; font-size: 14px; border-radius: 12px; display: inline-block;">
              Confirmer mon adresse e-mail
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b;">
            Ce lien est valable pendant <strong>24 heures</strong>.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
          MARKET SÉNÉGAL · Plateforme e-commerce sénégalaise
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"MARKET SÉNÉGAL" <${from}>`,
      to: params.to,
      subject: 'Confirmez votre adresse e-mail - MARKET SÉNÉGAL',
      text: `Bonjour,\n\nPour confirmer votre adresse e-mail sur MARKET SÉNÉGAL, rendez-vous sur :\n${params.verifyUrl}\n\nCe lien expire dans 24 heures.`,
      html: isHtml,
    });

    let previewUrl: string | undefined;
    if (mode === 'sandbox') {
      const etherealUrl = nodemailer.getTestMessageUrl(info);
      if (etherealUrl) previewUrl = etherealUrl;
    }

    return {
      sent: true,
      configured: true,
      mode,
      messageId: info.messageId,
      sandboxPreviewUrl: previewUrl,
    };
  } catch (err: any) {
    console.error('[Email Service] Échec envoi vérification:', err);
    return {
      sent: false,
      configured: true,
      mode: config.mode,
      reason: err.message || 'Échec d’envoi de l’e-mail de vérification.',
    };
  }
}
