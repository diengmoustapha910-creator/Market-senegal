import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from './db.js';
import {
  hashPassword,
  verifyPassword,
  type AuthenticatedRequest,
  requireAuth,
  requireSeller,
  requireAdmin
} from './auth.js';
import { paymentGateway } from './payments.js';
import {
  checkAiStatus,
  chatWithAssistant,
  draftConversationReply,
  generateProductIllustration
} from './ai.js';
import { checkEmailConfig, sendPasswordResetEmail } from './email.js';
import { storeFile, checkStorageConfig } from './storage.js';
import { OAuth2Client } from 'google-auth-library';

export const apiRouter = express.Router();

// Configuration publique et méta-données de l'application
apiRouter.get('/public-config', (req, res) => {
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  res.json({
    appUrl,
    metaAdsConfigured: Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
    metaPixelConfigured: Boolean(process.env.META_PIXEL_ID),
  });
});

// --- Protection anti-brute-force pour l'espace administrateur (Max 5 tentatives / 15 min) ---
interface FailedAttemptInfo {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}
const adminFailedAttempts = new Map<string, FailedAttemptInfo>();

function checkAdminRateLimit(key: string): { allowed: boolean; remainingMinutes?: number; remainingAttempts?: number } {
  const now = Date.now();
  const info = adminFailedAttempts.get(key);
  if (!info) return { allowed: true, remainingAttempts: 5 };

  if (info.lockedUntil && info.lockedUntil > now) {
    const remainingMinutes = Math.ceil((info.lockedUntil - now) / (60 * 1000));
    return { allowed: false, remainingMinutes };
  }

  if (now - info.lastAttempt > 15 * 60 * 1000) {
    adminFailedAttempts.delete(key);
    return { allowed: true, remainingAttempts: 5 };
  }

  if (info.count >= 5) {
    info.lockedUntil = now + 15 * 60 * 1000;
    return { allowed: false, remainingMinutes: 15 };
  }

  return { allowed: true, remainingAttempts: 5 - info.count };
}

function recordAdminFailedAttempt(key: string) {
  const now = Date.now();
  const info = adminFailedAttempts.get(key) || { count: 0, lastAttempt: now };
  info.count += 1;
  info.lastAttempt = now;
  if (info.count >= 5) {
    info.lockedUntil = now + 15 * 60 * 1000;
  }
  adminFailedAttempts.set(key, info);
}

function resetAdminFailedAttempts(key: string) {
  adminFailedAttempts.delete(key);
}

// Configuration Multer en mémoire (permet le transfert S3 / Cloudflare R2 ou local dev)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Veuillez envoyer une image JPG, PNG, WEBP ou un document PDF.'));
    }
  }
});

// Statut du stockage de fichiers (S3 / Local)
apiRouter.get('/storage/status', (_req, res) => {
  const status = checkStorageConfig();
  res.json(status);
});

// -----------------------------------------------------------------------------
// 1. UPLOAD DE FICHIERS (Produits, Logos, Bannières, Justificatifs Wave)
// -----------------------------------------------------------------------------
apiRouter.post('/upload', requireAuth, upload.single('photo'), async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier photo ou justificatif fourni.' });
  }

  try {
    const uploaded = await storeFile({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype
    });
    res.json({
      success: true,
      url: uploaded.url,
      filename: uploaded.filename,
      provider: uploaded.provider
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l’enregistrement du fichier.' });
  }
});

// -----------------------------------------------------------------------------
// 2. AUTHENTIFICATION GOOGLE (OAUTH 2.0 & GOOGLE IDENTITY)
// Strictement réservée aux clients : aucun compte Google ne peut recevoir
// automatiquement un rôle vendeur ou administrateur.
// -----------------------------------------------------------------------------

apiRouter.get('/auth/google/status', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  res.json({
    configured: Boolean(clientId && clientSecret),
    clientId: clientId || undefined
  });
});

apiRouter.get('/auth/google/url', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return res.status(400).json({
      configured: false,
      error: 'Google OAuth n’est pas configuré sur le serveur (variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requises).'
    });
  }

  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=select_account`;

  res.json({
    configured: true,
    url,
    redirectUri
  });
});

apiRouter.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;
  const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

  if (error) {
    return res.redirect(`${appUrl}/?google_error=${encodeURIComponent(String(error))}`);
  }
  if (!code || typeof code !== 'string') {
    return res.redirect(`${appUrl}/?google_error=Code_autorisation_manquant`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return res.redirect(`${appUrl}/?google_error=Configuration_Google_manquante`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let googleEmail: string | undefined;
    let googleName: string | undefined;

    if (tokens.id_token) {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      googleEmail = payload?.email;
      googleName = payload?.name;
    }

    if (!googleEmail && tokens.access_token) {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const info = await userInfoRes.json() as any;
      googleEmail = info.email;
      googleName = info.name;
    }

    if (!googleEmail) {
      return res.redirect(`${appUrl}/?google_error=Impossible_de_recuperer_adresse_email`);
    }

    const cleanEmail = googleEmail.toLowerCase().trim();
    let user = await db.getUserByEmail(cleanEmail);

    if (!user) {
      // RÈGLE DE SÉCURITÉ : Le compte Google est TOUJOURS strictement assigné au rôle 'client'
      user = await db.createUser({
        email: cleanEmail,
        password_hash: '', // Utilisateur authentifié via OAuth Google
        full_name: googleName || 'Client Google',
        role: 'client'
      });
      await db.addAuditLog(user.id, 'google_signup', 'user', user.id, {
        email: cleanEmail,
        role: 'client',
        provider: 'google'
      });
    } else {
      await db.addAuditLog(user.id, 'google_login', 'user', user.id, {
        email: cleanEmail,
        provider: 'google'
      });
    }

    const session = await db.createSession(user.id);
    res.redirect(`${appUrl}/?auth_token=${session.token}`);
  } catch (err: any) {
    console.error('[Google OAuth Error]', err);
    res.redirect(`${appUrl}/?google_error=${encodeURIComponent(err.message || 'Erreur_echange_oauth')}`);
  }
});

apiRouter.post('/auth/google/verify-credential', async (req, res) => {
  try {
    const { credential } = req.body;
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

    if (!clientId) {
      return res.status(400).json({ error: 'Google OAuth non configuré sur le serveur (GOOGLE_CLIENT_ID manquant).' });
    }
    if (!credential) {
      return res.status(400).json({ error: 'Jeton d’identification Google manquant.' });
    }

    const oauth2Client = new OAuth2Client(clientId);
    const ticket = await oauth2Client.verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ error: 'Jeton Google invalide ou e-mail introuvable.' });
    }

    const cleanEmail = payload.email.toLowerCase().trim();
    let user = await db.getUserByEmail(cleanEmail);

    if (!user) {
      // RÈGLE DE SÉCURITÉ : Un compte Google ne doit jamais recevoir automatiquement un rôle vendeur ou administrateur.
      user = await db.createUser({
        email: cleanEmail,
        password_hash: '',
        full_name: payload.name || 'Client Google',
        role: 'client'
      });
      await db.addAuditLog(user.id, 'google_signup', 'user', user.id, {
        email: cleanEmail,
        role: 'client',
        provider: 'google'
      });
    }

    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    const store = await db.getStoreByUserId(user.id);

    res.json({
      success: true,
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la validation du compte Google.' });
  }
});

// -----------------------------------------------------------------------------
// 2. AUTHENTIFICATION & UTILISATEURS
// -----------------------------------------------------------------------------

// Inscription Client
apiRouter.post('/auth/register', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Veuillez remplir votre nom complet, email et mot de passe.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Un compte avec cette adresse e-mail existe déjà.' });
    }

    const password_hash = hashPassword(password);
    const user = await db.createUser({
      email: email.trim().toLowerCase(),
      password_hash,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : undefined,
      role: 'client'
    });

    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;

    res.status(201).json({
      success: true,
      user: safeUser,
      token: session.token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de l’inscription.' });
  }
});

// Connexion
apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Veuillez renseigner votre email et mot de passe.' });
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;
    const store = await db.getStoreByUserId(user.id);

    res.json({
      success: true,
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la connexion.' });
  }
});

// Récupération de l'utilisateur courant
apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { password_hash: _, ...safeUser } = req.user!;
  // Check if user has an associated store
  const store = await db.getStoreByUserId(req.user!.id);
  res.json({ user: safeUser, store });
});

// Déconnexion
apiRouter.post('/auth/logout', async (req: AuthenticatedRequest, res) => {
  if (req.sessionToken) {
    await db.deleteSession(req.sessionToken);
  }
  res.json({ success: true });
});

// Statut de la configuration du fournisseur d'e-mails (SMTP)
apiRouter.get('/auth/email-status', (_req, res) => {
  const status = checkEmailConfig();
  res.json({
    configured: status.configured,
    missingVars: status.missingVars,
    provider: status.provider
  });
});

// Récupération / demande de réinitialisation de mot de passe utilisateur
apiRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Veuillez renseigner votre adresse e-mail.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailConfig = checkEmailConfig();
    const user = await db.getUserByEmail(cleanEmail);

    let resetToken: string | null = null;
    let resetUrl: string | null = null;
    let emailSent = false;
    let sendFailureReason: string | null = null;

    if (user) {
      resetToken = await db.createPasswordResetToken(cleanEmail, user.role);
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      resetUrl = `${appUrl}/?reset_token=${resetToken}`;

      if (emailConfig.configured) {
        const sendResult = await sendPasswordResetEmail({
          to: cleanEmail,
          resetUrl,
          token: resetToken,
          role: user.role,
          userName: user.full_name
        });
        emailSent = sendResult.sent;
        if (!sendResult.sent) {
          sendFailureReason = sendResult.reason || 'Échec de transmission SMTP';
        }
      }
    }

    if (!emailConfig.configured) {
      return res.json({
        success: true,
        email_configured: false,
        email_sent: false,
        missing_config: emailConfig.missingVars,
        message: 'La procédure de réinitialisation a été amorcée. Toutefois, le fournisseur d’e-mails (SMTP) n’est pas configuré sur le serveur (variables SMTP_HOST, SMTP_USER, SMTP_PASSWORD manquantes) : aucun e-mail n’a pu être expédié et ce service ne fonctionnera pas en production tant que le SMTP n’est pas configuré.',
        dev_reset_token: resetToken || undefined,
        dev_reset_url: resetUrl || undefined
      });
    }

    // Confidentialité absolue (OWASP) : Réponse neutre uniforme ne révélant jamais l'existence du compte
    return res.json({
      success: true,
      email_configured: true,
      email_sent: true,
      message: 'Si cette adresse correspond à un compte actif sur la plateforme, les instructions sécurisées de réinitialisation ont été transmises par e-mail.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la demande de réinitialisation.' });
  }
});

// Vérification de validité d'un jeton avant saisie
apiRouter.get('/auth/verify-reset-token', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Jeton manquant.' });
    }

    const check = await db.checkPasswordResetToken(token);
    if (!check) {
      return res.status(400).json({
        valid: false,
        error: 'Ce lien de réinitialisation est invalide ou a expiré (durée limite : 30 minutes).'
      });
    }

    res.json({
      valid: true
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Validation et enregistrement effectif du nouveau mot de passe
apiRouter.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, new_password, newPassword } = req.body;
    const passwordToSet = (new_password || newPassword || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Jeton de réinitialisation manquant.' });
    }

    if (!passwordToSet || passwordToSet.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
    }

    const newHash = hashPassword(passwordToSet);
    const updatedUser = await db.verifyAndConsumePasswordResetToken(token, newHash);

    if (!updatedUser) {
      return res.status(400).json({
        error: 'Ce lien de réinitialisation est invalide, a expiré ou a déjà été utilisé (jeton à usage unique).'
      });
    }

    const session = await db.createSession(updatedUser.id);
    const { password_hash: _, ...safeUser } = updatedUser;
    const store = await db.getStoreByUserId(updatedUser.id);

    res.json({
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous êtes désormais connecté avec vos nouveaux identifiants.',
      user: safeUser,
      store: store || null,
      token: session.token
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la réinitialisation du mot de passe.' });
  }
});

// -----------------------------------------------------------------------------
// ESPACE DÉDIÉ : AUTHENTIFICATION ADMINISTRATEUR (SÉCURISÉE & ANTI-BRUTE-FORCE)
// -----------------------------------------------------------------------------

apiRouter.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'ip';
    const rateLimitKey = `${clientIp}_${(email || '').toLowerCase().trim()}`;

    // Vérification du verrouillage anti-brute-force (Max 5 tentatives / 15 minutes)
    const limitStatus = checkAdminRateLimit(rateLimitKey);
    if (!limitStatus.allowed) {
      return res.status(429).json({
        error: `Accès temporairement suspendu suite à 5 tentatives infructueuses. Veuillez patienter ${limitStatus.remainingMinutes} minute(s) avant de réessayer.`
      });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Veuillez saisir votre e-mail administrateur et votre mot de passe.' });
    }

    const user = await db.getUserByEmail(email);

    // Vérification stricte : le compte doit exister ET avoir explicitement le rôle 'admin'
    if (!user || user.role !== 'admin') {
      recordAdminFailedAttempt(rateLimitKey);
      const updatedLimit = checkAdminRateLimit(rateLimitKey);
      return res.status(401).json({
        error: 'Identifiants administrateur non reconnus.',
        attemptsRemaining: updatedLimit.remainingAttempts
      });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      recordAdminFailedAttempt(rateLimitKey);
      const updatedLimit = checkAdminRateLimit(rateLimitKey);
      await db.addAuditLog(user.id, 'admin_login_failed', 'security', user.id, {
        ip: clientIp,
        attemptsRemaining: updatedLimit.remainingAttempts
      });
      return res.status(401).json({
        error: 'Mot de passe administrateur incorrect.',
        attemptsRemaining: updatedLimit.remainingAttempts
      });
    }

    // Réinitialisation du compteur après succès
    resetAdminFailedAttempts(rateLimitKey);
    const session = await db.createSession(user.id);
    const { password_hash: _, ...safeUser } = user;

    await db.addAuditLog(user.id, 'admin_login_success', 'security', user.id, {
      ip: clientIp
    });

    res.json({
      success: true,
      user: safeUser,
      token: session.token,
      must_change_password: Boolean(user.must_change_password)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la connexion administrateur.' });
  }
});

// Récupération de mot de passe administrateur sécurisée
apiRouter.post('/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Veuillez saisir votre adresse e-mail d’administration.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.getUserByEmail(cleanEmail);
    const emailConfig = checkEmailConfig();

    let resetToken: string | null = null;
    let resetUrl: string | null = null;
    let emailSent = false;
    let sendFailureReason: string | null = null;

    if (user && user.role === 'admin') {
      resetToken = await db.createPasswordResetToken(cleanEmail, 'admin');
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      resetUrl = `${appUrl}/admin/login?reset_token=${resetToken}`;
      console.log(`[Sécurité Admin] Jeton de récupération généré pour ${cleanEmail} : ${resetToken}`);

      if (emailConfig.configured) {
        const sendResult = await sendPasswordResetEmail({
          to: cleanEmail,
          resetUrl,
          token: resetToken,
          role: 'admin',
          userName: user.full_name
        });
        emailSent = sendResult.sent;
        if (!sendResult.sent) {
          sendFailureReason = sendResult.reason || 'Échec d’envoi SMTP';
        }
      }
    }

    if (!emailConfig.configured) {
      return res.json({
        success: true,
        email_configured: false,
        email_sent: false,
        missing_config: emailConfig.missingVars,
        message: 'La procédure a été initiée. Le serveur SMTP d’e-mails n’étant pas configuré sur ce serveur (variables SMTP_HOST, SMTP_USER, SMTP_PASSWORD manquantes), aucun e-mail n’a été expédié. En production, les e-mails ne fonctionneront pas tant que le SMTP n’est pas configuré.',
        recovery_token: resetToken || undefined,
        dev_reset_url: resetUrl || undefined
      });
    }

    // Confidentialité absolue (OWASP) : Réponse neutre uniforme ne révélant jamais l'existence du compte administrateur
    return res.json({
      success: true,
      email_configured: true,
      email_sent: true,
      message: 'Si les informations saisies correspondent à un compte d’administration valide, un lien sécurisé de réinitialisation a été transmis par e-mail.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Jeton de récupération et nouveau mot de passe requis.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe administrateur doit comporter au moins 8 caractères.' });
    }

    const newHash = hashPassword(new_password);
    const updatedUser = await db.verifyAndConsumePasswordResetToken(token, newHash);
    if (!updatedUser) {
      return res.status(400).json({ error: 'Jeton de sécurité invalide ou expiré.' });
    }

    res.json({
      success: true,
      message: 'Votre mot de passe administrateur a été mis à jour avec succès. Vous pouvez désormais vous connecter.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Définition du mot de passe lors de la première connexion de l'administrateur
apiRouter.post('/admin/first-login-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { new_password, newPassword } = req.body;
    const passwordToSet = (new_password || newPassword || '').trim();

    if (!passwordToSet || passwordToSet.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
    }

    const newHash = hashPassword(passwordToSet);
    const updated = await db.updateUserPassword(req.user!.id, newHash, false);
    if (!updated) {
      return res.status(404).json({ error: 'Administrateur introuvable.' });
    }

    // Invalide toutes les autres sessions éventuelles
    if (req.sessionToken) {
      await db.invalidateOtherSessions(req.user!.id, req.sessionToken);
    }

    await db.addAuditLog(req.user!.id, 'admin_first_login_password_set', 'security', req.user!.id, {
      email: req.user!.email
    });

    const { password_hash: _, ...safeUser } = updated;
    res.json({
      success: true,
      message: 'Votre mot de passe administrateur personnel a été configuré avec succès.',
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la configuration du mot de passe.' });
  }
});

// Changement de mot de passe administrateur (accessible à tout moment dans les paramètres de sécurité)
apiRouter.post('/admin/change-password', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { current_password, currentPassword, new_password, newPassword } = req.body;
    const currentPass = (current_password || currentPassword || '').trim();
    const newPass = (new_password || newPassword || '').trim();

    if (!currentPass) {
      return res.status(400).json({ error: 'Veuillez saisir votre mot de passe actuel.' });
    }

    if (!newPass || newPass.length < 8) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
    }

    if (currentPass === newPass) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit être différent de l’actuel.' });
    }

    // Vérifie le mot de passe actuel
    const isValid = verifyPassword(currentPass, req.user!.password_hash);
    if (!isValid) {
      await db.addAuditLog(req.user!.id, 'admin_password_change_failed', 'security', req.user!.id, {
        reason: 'wrong_current_password'
      });
      return res.status(401).json({ error: 'Le mot de passe actuel est incorrect.' });
    }

    // Enregistrement de la nouvelle empreinte sécurisée
    const newHash = hashPassword(newPass);
    const updated = await db.updateUserPassword(req.user!.id, newHash, false);
    if (!updated) {
      return res.status(404).json({ error: 'Administrateur introuvable.' });
    }

    // Invalidation de toutes les AUTRES sessions actives
    const otherSessionsTerminated = req.sessionToken
      ? await db.invalidateOtherSessions(req.user!.id, req.sessionToken)
      : 0;

    await db.addAuditLog(req.user!.id, 'admin_password_changed', 'security', req.user!.id, {
      otherSessionsTerminated
    });

    const { password_hash: _, ...safeUser } = updated;
    res.json({
      success: true,
      message: 'Votre mot de passe a été modifié avec succès. Toutes vos autres sessions actives ont été invalidées pour protéger votre compte.',
      otherSessionsTerminated,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors du changement de mot de passe.' });
  }
});

// Mise à jour du profil client
apiRouter.put('/auth/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { full_name, phone } = req.body;
    const updated = await db.updateUserProfile(req.user!.id, { full_name, phone });
    if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    const { password_hash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 3. BOUTIQUES (STORES)
// -----------------------------------------------------------------------------

// Liste des boutiques actives (Public)
apiRouter.get('/stores', async (_req, res) => {
  try {
    const stores = await db.listPublicStores();
    res.json({ stores });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Détail public d'une boutique (par slug ou ID)
apiRouter.get('/stores/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    let store = await db.getStoreBySlug(slugOrId);
    if (!store) {
      store = await db.getStoreById(slugOrId);
    }
    if (!store) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    if (store.is_suspended) {
      return res.status(403).json({ error: 'Cette boutique est temporairement suspendue par la modération.' });
    }

    const categories = await db.getStoreCategories(store.id);
    const deliveryZones = await db.getDeliveryZones(store.id);
    const productsRes = await db.listPublicProducts({ storeId: store.id });

    res.json({
      store,
      categories,
      deliveryZones,
      products: productsRes.products
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Créer une boutique (Un client devient vendeur instantanément, sans attente d'approbation)
apiRouter.post('/stores', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await db.getStoreByUserId(req.user!.id);
    if (existing) {
      return res.status(400).json({ error: 'Vous possédez déjà une boutique enregistrée sur Market Sénégal.' });
    }

    const { name, description, phone, address, city, logo_url, banner_url, allows_cod } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ error: 'Le nom de la boutique, le téléphone et l’adresse sont obligatoires.' });
    }

    const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slug = `${baseSlug}-${Math.floor(100 + Math.random() * 900)}`;

    const store = await db.createStore({
      user_id: req.user!.id,
      name: name.trim(),
      slug,
      description: description ? description.trim() : '',
      phone: phone.trim(),
      address: address.trim(),
      city: city ? city.trim() : 'Dakar',
      logo_url,
      banner_url,
      plan_tier: 'essentiel', // Plan par défaut
      allows_cod: allows_cod !== false
    });

    res.status(201).json({ success: true, store });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Configuration de la boutique par le vendeur
apiRouter.put('/vendor/store', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const { name, description, phone, address, city, logo_url, banner_url, allows_cod } = req.body;
    const updated = await db.updateStore(store.id, {
      name,
      description,
      phone,
      address,
      city,
      logo_url,
      banner_url,
      allows_cod
    });

    res.json({ success: true, store: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer la boutique du vendeur connecté
apiRouter.get('/vendor/my-store', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Aucune boutique associée.' });
    const zones = await db.getDeliveryZones(store.id);
    const categories = await db.getStoreCategories(store.id);
    const coupons = await db.getStoreCoupons(store.id);

    res.json({ store, zones, categories, coupons });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 4. CATÉGORIES DE BOUTIQUE (propres à chaque vendeur)
// -----------------------------------------------------------------------------
apiRouter.get('/vendor/categories', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const categories = await db.getStoreCategories(store.id);
  res.json({ categories });
});

apiRouter.post('/vendor/categories', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom de catégorie obligatoire.' });
  const category = await db.createStoreCategory(store.id, name);
  res.status(201).json({ success: true, category });
});

apiRouter.delete('/vendor/categories/:id', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const success = await db.deleteStoreCategory(req.params.id, store.id);
  res.json({ success });
});

// -----------------------------------------------------------------------------
// 5. ZONES ET TARIFS DE LIVRAISON DU VENDEUR
// -----------------------------------------------------------------------------
apiRouter.get('/vendor/delivery-zones', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const zones = await db.getDeliveryZones(store.id);
  res.json({ zones });
});

apiRouter.post('/vendor/delivery-zones', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

  const { region, price_fcfa, estimated_days } = req.body;
  if (!region || price_fcfa === undefined) {
    return res.status(400).json({ error: 'La région et le tarif en FCFA sont obligatoires.' });
  }

  const zone = await db.createDeliveryZone({
    store_id: store.id,
    region,
    price_fcfa: Number(price_fcfa),
    estimated_days: estimated_days || '24-48h'
  });

  res.status(201).json({ success: true, zone });
});

apiRouter.delete('/vendor/delivery-zones/:id', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const success = await db.deleteDeliveryZone(req.params.id, store.id);
  res.json({ success });
});

// -----------------------------------------------------------------------------
// 6. PRODUITS
// -----------------------------------------------------------------------------

// Liste publique des produits avec filtres
apiRouter.get('/products', async (req, res) => {
  try {
    const { search, storeId, categoryId, region, minPrice, maxPrice, sort } = req.query;
    const result = await db.listPublicProducts({
      search: search as string,
      storeId: storeId as string,
      categoryId: categoryId as string,
      region: region as string,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort: sort as any
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Détail public d'un produit
apiRouter.get('/products/:id', async (req, res) => {
  try {
    const product = await db.getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    if (product.store.is_suspended) {
      return res.status(403).json({ error: 'Ce produit n’est plus disponible.' });
    }
    const deliveryZones = await db.getDeliveryZones(product.store_id);
    res.json({ product, deliveryZones });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gestion produits par le vendeur
apiRouter.get('/vendor/products', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const products = await db.listStoreProducts(store.id);
  res.json({ products });
});

apiRouter.post('/vendor/products', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const { name, description, price_fcfa, compare_price_fcfa, stock_quantity, images, ai_images, category_id, is_active } = req.body;

    if (!name || !description || !price_fcfa) {
      return res.status(400).json({ error: 'Nom, description et prix sont obligatoires.' });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Une photo réelle du produit est obligatoirement requise comme référence principale.' });
    }

    const product = await db.createProduct({
      store_id: store.id,
      category_id: category_id || undefined,
      name: name.trim(),
      description: description.trim(),
      price_fcfa: Number(price_fcfa),
      compare_price_fcfa: compare_price_fcfa ? Number(compare_price_fcfa) : undefined,
      stock_quantity: Number(stock_quantity || 0),
      images,
      ai_images: Array.isArray(ai_images) ? ai_images : [],
      is_active: is_active !== false
    });

    res.status(201).json({ success: true, product });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/vendor/products/:id', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    // Si des images sont transmises, s'assurer qu'au moins une vraie photo persiste
    if (req.body.images && (!Array.isArray(req.body.images) || req.body.images.length === 0)) {
      return res.status(400).json({ error: 'La photo réelle principale du produit ne peut pas être supprimée.' });
    }

    const updated = await db.updateProduct(req.params.id, store.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json({ success: true, product: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/vendor/products/:id', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
  const success = await db.deleteProduct(req.params.id, store.id);
  res.json({ success });
});

// -----------------------------------------------------------------------------
// 7. PROMOTIONS & CODES DE RÉDUCTION (Forfait Croissance uniquement)
// -----------------------------------------------------------------------------
apiRouter.get('/vendor/coupons', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

  // Server-side plan check: promotions reserved for Croissance plan
  if (store.plan_tier !== 'croissance') {
    return res.status(403).json({
      error: 'La création de codes promo nécessite le forfait Croissance (18 000 FCFA / mois).'
    });
  }

  const coupons = await db.getStoreCoupons(store.id);
  res.json({ coupons });
});

apiRouter.post('/vendor/coupons', requireSeller, async (req: AuthenticatedRequest, res) => {
  const store = await db.getStoreByUserId(req.user!.id);
  if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

  if (store.plan_tier !== 'croissance') {
    return res.status(403).json({
      error: 'La création de codes promo nécessite le forfait Croissance (18 000 FCFA / mois).'
    });
  }

  const { code, discount_percent, discount_amount_fcfa, min_order_amount_fcfa, expires_at } = req.body;
  if (!code) return res.status(400).json({ error: 'Code promo requis.' });

  const coupon = await db.createCoupon(store.id, {
    code,
    discount_percent: discount_percent ? Number(discount_percent) : undefined,
    discount_amount_fcfa: discount_amount_fcfa ? Number(discount_amount_fcfa) : undefined,
    min_order_amount_fcfa: Number(min_order_amount_fcfa || 0),
    is_active: true,
    expires_at
  });

  res.status(201).json({ success: true, coupon });
});

// -----------------------------------------------------------------------------
// 8. DEVIS PANIER MULTI-VENDEURS & PASSERELLE PAIEMENT
// -----------------------------------------------------------------------------
apiRouter.post('/cart/quote', async (req, res) => {
  try {
    const { items, deliveryRegion } = req.body;
    // items: Array<{ productId: string; quantity: number }>
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ groups: [], totalItems: 0, grandTotal: 0 });
    }

    // Group items by store
    const storeMap = new Map<string, Array<{ productId: string; quantity: number }>>();

    for (const it of items) {
      const p = await db.getProductById(it.productId);
      if (!p) continue;
      if (!storeMap.has(p.store_id)) {
        storeMap.set(p.store_id, []);
      }
      storeMap.get(p.store_id)!.push(it);
    }

    const groups: any[] = [];
    let grandTotal = 0;

    for (const [storeId, storeItems] of storeMap.entries()) {
      const store = await db.getStoreById(storeId);
      if (!store || store.is_suspended) continue;

      const zones = await db.getDeliveryZones(storeId);
      const matchedZone = deliveryRegion
        ? zones.find(z => z.region.toLowerCase() === deliveryRegion.toLowerCase())
        : undefined;

      let subtotal = 0;
      const parsedItems = [];

      for (const it of storeItems) {
        const prod = await db.getProductById(it.productId);
        if (!prod) continue;
        const lineTotal = prod.price_fcfa * it.quantity;
        subtotal += lineTotal;
        parsedItems.push({
          productId: prod.id,
          name: prod.name,
          image: prod.images[0] || '',
          unitPrice: prod.price_fcfa,
          quantity: it.quantity,
          lineTotal,
          stock: prod.stock_quantity
        });
      }

      const deliveryFee = matchedZone ? matchedZone.price_fcfa : 0;
      const storeTotal = subtotal + deliveryFee;
      grandTotal += storeTotal;

      groups.push({
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        storeCity: store.city,
        allowsCod: store.allows_cod,
        isDeliveringToRegion: Boolean(matchedZone),
        deliveryFee,
        deliveryTime: matchedZone ? matchedZone.estimated_days : 'Non desservi',
        availableZones: zones.map(z => z.region),
        subtotal,
        storeTotal,
        items: parsedItems
      });
    }

    res.json({
      groups,
      grandTotal,
      supportedPaymentMethods: paymentGateway.getAvailableMethods(true)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 9. COMMANDES (ORDERS)
// -----------------------------------------------------------------------------
apiRouter.post('/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerName,
      customerPhone,
      deliveryRegion,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      storeOrders
    } = req.body;

    if (!customerName || !customerPhone || !deliveryRegion || !deliveryAddress) {
      return res.status(400).json({
        error: 'Nom, téléphone, région et adresse de livraison complète sont requis.'
      });
    }

    if (!storeOrders || !Array.isArray(storeOrders) || storeOrders.length === 0) {
      return res.status(400).json({ error: 'Le panier de commande est vide.' });
    }

    // Server-side payment validation for customer orders
    if (paymentMethod === 'wave' || paymentMethod === 'orange_money') {
      return res.status(400).json({
        error: 'Les paiements Wave et Orange Money des commandes clients nécessitent une future intégration API dynamique (le montant varie selon le panier). Le paiement en ligne n’est pas encore disponible pour les commandes. N’utilisez pas les liens de paiement professionnels des vendeurs.'
      });
    }

    if (paymentMethod === 'paiement_livraison') {
      // Ensure all stores in order group have configured COD
      for (const group of storeOrders) {
        const store = await db.getStoreById(group.storeId);
        if (store && store.allows_cod === false) {
          return res.status(400).json({
            error: `La boutique "${store.name}" n’a pas activé le paiement à la livraison. Aucun moyen de paiement disponible pour cette commande.`
          });
        }
      }
    } else {
      return res.status(400).json({
        error: 'Moyen de paiement non configuré pour les commandes clients.'
      });
    }

    const created = await db.createOrderGroup({
      customerId: req.user!.id,
      customerName,
      customerPhone,
      deliveryRegion,
      deliveryAddress,
      deliveryNotes,
      paymentMethod,
      storeOrders
    });

    res.status(201).json({
      success: true,
      orders: created,
      message: `Votre commande a été transmise aux vendeurs avec succès.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Commandes du client connecté
apiRouter.get('/customer/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const orders = await db.getCustomerOrders(req.user!.id);
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Commandes reçues par le vendeur
apiRouter.get('/vendor/orders', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
    const orders = await db.getStoreOrders(store.id);
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mise à jour du statut d'une commande par le vendeur
apiRouter.put('/vendor/orders/:id/status', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const { status } = req.body;
    const allowed = ['confirmee', 'en_livraison', 'livree', 'annulee'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Statut de commande invalide.' });
    }

    const order = await db.updateOrderStatus(req.params.id, store.id, status);
    if (!order) return res.status(404).json({ error: 'Commande introuvable.' });

    res.json({ success: true, order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export CSV des commandes (Forfait Croissance uniquement)
apiRouter.get('/vendor/orders/export-csv', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    if (store.plan_tier !== 'croissance') {
      return res.status(403).json({
        error: 'L’export CSV des commandes est une fonctionnalité réservée au forfait Croissance.'
      });
    }

    const orders = await db.getStoreOrders(store.id);
    const headers = 'Numéro;Date;Client;Téléphone;Région;Adresse;Articles;Total FCFA;Mode Paiement;Statut\n';
    const rows = orders.map(o => {
      const itemsStr = o.items.map(i => `${i.product_name} (x${i.quantity})`).join(' | ');
      return `"${o.order_number}";"${o.created_at}";"${o.customer_name}";"${o.customer_phone}";"${o.delivery_region}";"${o.delivery_address.replace(/"/g, '""')}";"${itemsStr}";${o.total_fcfa};"${o.payment_method}";"${o.status}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commandes_${store.slug}_${Date.now()}.csv"`);
    res.send('\uFEFF' + headers + rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 10. MESSAGERIE PRIVÉE (CLIENTS - VENDEURS)
// -----------------------------------------------------------------------------
apiRouter.get('/conversations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const convs = await db.listUserConversations(req.user!.id, req.user!.role);
    res.json({ conversations: convs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/conversations/unread-count', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const convs = await db.listUserConversations(req.user!.id, req.user!.role);
    const unreadCount = convs.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0);
    res.json({ unread_count: unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/conversations/start', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'ID de la boutique requis.' });

    const store = await db.getStoreById(storeId);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });
    if (store.user_id === req.user!.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas engager une conversation avec vous-même.' });
    }

    const conversation = await db.getOrCreateConversation(storeId, req.user!.id);
    res.json({ success: true, conversation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const messages = await db.getConversationMessages(req.params.id, req.user!.id);
    res.json({ messages });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

apiRouter.post('/conversations/:id/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide.' });
    }
    const message = await db.sendMessage(req.params.id, req.user!.id, content);
    res.status(201).json({ success: true, message });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 11. ABONNEMENTS BOUTIQUE & STATS VENDEUR
// -----------------------------------------------------------------------------
apiRouter.get('/vendor/subscriptions', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const subscriptions = await db.getStoreSubscriptions(store.id);
    const pendingSubscription = subscriptions.find(s => s.status === 'paiement_a_verifier' || s.status === 'en_attente') || null;
    res.json({ subscriptions, pendingSubscription, store });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vue consolidée des paiements professionnels du vendeur (Abonnements & Services)
apiRouter.get('/vendor/pro-payments', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const data = await db.getVendorProPayments(store.id);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/vendor/subscriptions/request', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const { planTier, offlineReference, proofDocumentUrl, notes } = req.body;
    if (planTier !== 'essentiel' && planTier !== 'croissance') {
      return res.status(400).json({ error: 'Forfait invalide (Essentiel ou Croissance).' });
    }

    if (planTier === 'croissance') {
      return res.status(400).json({
        error: 'Le moyen de paiement pour le forfait Croissance (18 000 FCFA) n’est pas configuré. N’utilisez pas le lien Essentiel. Veuillez contacter l’administration.'
      });
    }

    const ref = (offlineReference || '').trim();
    if (!ref && !proofDocumentUrl) {
      return res.status(400).json({
        error: 'Veuillez saisir votre référence de transaction Wave ou téléverser un justificatif de paiement.'
      });
    }

    // Empêcher le traitement en double d’une même référence de paiement
    if (ref && db.isPaymentReferenceUsed(ref)) {
      return res.status(400).json({
        error: 'Cette référence de paiement Wave a déjà été enregistrée pour une autre transaction. Pour éviter tout paiement en double, veuillez vérifier votre reçu Wave.'
      });
    }

    const sub = await db.createSubscriptionRequest(
      store.id,
      planTier,
      ref,
      proofDocumentUrl,
      notes
    );

    res.status(201).json({
      success: true,
      subscription: sub,
      message: 'Demande enregistrée au statut « Paiement à vérifier ». L’administrateur vérifiera l’encaissement réel avant d’activer le forfait pour un mois.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Statistiques des ventes du vendeur
apiRouter.get('/vendor/stats', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const orders = await db.getStoreOrders(store.id);
    const validOrders = orders.filter(o => o.status !== 'annulee');
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.subtotal_fcfa, 0);

    const isCroissance = store.plan_tier === 'croissance';

    res.json({
      planTier: store.plan_tier,
      isCroissance,
      totalOrders: orders.length,
      deliveredOrders: orders.filter(o => o.status === 'livree').length,
      totalRevenueFcfa: totalRevenue,
      // Advanced analytics for Croissance tier
      recentSalesBreakdown: isCroissance ? validOrders.slice(0, 10).map(o => ({
        orderNumber: o.order_number,
        date: o.created_at,
        amount: o.total_fcfa,
        region: o.delivery_region
      })) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 12. AVIS SUR LA PLATEFORME MARKET SÉNÉGAL
// -----------------------------------------------------------------------------
apiRouter.get('/reviews', async (_req, res) => {
  try {
    const reviews = await db.listApprovedPlatformReviews();
    res.json({ reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/reviews', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment) {
      return res.status(400).json({ error: 'La note (1 à 5) et un commentaire sont requis.' });
    }
    const review = await db.createPlatformReview(req.user!.id, rating, comment);
    res.status(201).json({ success: true, review });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 13. ESPACE ADMINISTRATEUR
// -----------------------------------------------------------------------------
apiRouter.get('/admin/stats', requireAdmin, async (_req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/users', requireAdmin, async (_req, res) => {
  try {
    const users = await db.listUsers();
    const safeUsers = users.map(({ password_hash: _, ...u }) => u);
    res.json({ users: safeUsers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/stores', requireAdmin, async (_req, res) => {
  try {
    const stores = await db.listAllStoresForAdmin();
    res.json({ stores });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/stores/:id/suspend', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Le motif de suspension est obligatoire.' });

    const store = await db.suspendStore(req.params.id, req.user!.id, reason);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    await db.addAuditLog(req.user!.id, 'suspend_store', 'store', store.id, {
      store_name: store.name,
      reason
    });

    res.json({ success: true, store });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/stores/:id/reactivate', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    const store = await db.reactivateStore(req.params.id, req.user!.id, reason || 'Réactivation administrative');
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    await db.addAuditLog(req.user!.id, 'reactivate_store', 'store', store.id, {
      store_name: store.name,
      reason
    });

    res.json({ success: true, store });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/stores/:id/suspension-history', requireAdmin, async (req, res) => {
  try {
    const history = await db.getStoreSuspensionHistory(req.params.id);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/subscriptions', requireAdmin, async (_req, res) => {
  try {
    const subscriptions = await db.listSubscriptions();
    res.json({ subscriptions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/admin/subscriptions/:id/validate', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentReference } = req.body;
    if (!paymentReference) {
      return res.status(400).json({ error: 'Référence du paiement hors-plateforme requise.' });
    }

    const sub = await db.validateSubscriptionOffline(req.params.id, req.user!.id, paymentReference);
    if (!sub) return res.status(404).json({ error: 'Abonnement introuvable.' });

    res.json({ success: true, subscription: sub });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/reviews', requireAdmin, async (_req, res) => {
  try {
    const reviews = await db.listAllPlatformReviewsForAdmin();
    res.json({ reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/admin/reviews/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { isApproved } = req.body;
    const review = await db.toggleReviewApproval(req.params.id, Boolean(isApproved));
    if (!review) return res.status(404).json({ error: 'Avis introuvable.' });

    await db.addAuditLog(req.user!.id, 'moderate_review', 'platform_review', review.id, {
      isApproved
    });

    res.json({ success: true, review });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/audit-logs', requireAdmin, async (_req, res) => {
  try {
    const logs = await db.listAuditLogs();
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/admin/orders', requireAdmin, async (_req, res) => {
  try {
    const orders = await db.listAllOrdersForAdmin();
    res.json({ orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 14. CERTIFICATION DES BOUTIQUES (10 000 FCFA via Wave)
// -----------------------------------------------------------------------------

// Récupérer le statut de certification de la boutique connectée
apiRouter.get('/vendor/certification', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const currentCert = await db.getStoreCertification(store.id);
    const history = await db.getStoreCertificationHistory(store.id);

    res.json({
      store,
      currentCert,
      history
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Soumettre une demande de certification après paiement Wave de 10 000 FCFA
apiRouter.post('/vendor/certification/request', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    const { wavePaymentReference, proofDocumentUrl, vendorNotes } = req.body;
    const ref = (wavePaymentReference || '').trim();
    if (!ref) {
      return res.status(400).json({
        error: 'Veuillez saisir la référence de la transaction Wave (10 000 FCFA) pour permettre sa vérification.'
      });
    }

    // Empêcher le traitement en double d’une même référence de paiement
    if (db.isPaymentReferenceUsed(ref)) {
      return res.status(400).json({
        error: 'Cette référence de paiement Wave a déjà été enregistrée sur la plateforme pour une autre transaction. Pour éviter tout paiement en double, veuillez vérifier votre reçu Wave.'
      });
    }

    const cert = await db.submitCertificationRequest({
      storeId: store.id,
      wavePaymentReference: ref,
      proofDocumentUrl: proofDocumentUrl || undefined,
      vendorNotes: vendorNotes || undefined
    });

    const updatedStore = await db.getStoreById(store.id);

    res.status(201).json({
      success: true,
      certification: cert,
      store: updatedStore,
      message: 'Demande de certification transmise. Statut : Paiement à vérifier par l’administrateur.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Liste de toutes les demandes de certification pour l'administration
apiRouter.get('/admin/certifications', requireAdmin, async (_req, res) => {
  try {
    const certifications = await db.listAllCertificationsForAdmin();
    res.json({ certifications });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validation et approbation de certification par l'administrateur
apiRouter.post('/admin/certifications/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { verifiedPaymentReference, adminNotes } = req.body;
    if (!verifiedPaymentReference || !verifiedPaymentReference.trim()) {
      return res.status(400).json({
        error: 'La référence vérifiée du paiement Wave (10 000 FCFA) est obligatoire.'
      });
    }

    const cert = await db.approveCertification(
      req.params.id,
      req.user!.id,
      verifiedPaymentReference.trim(),
      adminNotes
    );

    if (!cert) return res.status(404).json({ error: 'Demande de certification introuvable.' });

    res.json({ success: true, certification: cert, message: 'Boutique certifiée avec succès.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rejet d'une demande de certification avec motif
apiRouter.post('/admin/certifications/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;
    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ error: 'Le motif de refus est obligatoire.' });
    }

    const cert = await db.rejectCertification(
      req.params.id,
      req.user!.id,
      rejectionReason.trim(),
      adminNotes
    );

    if (!cert) return res.status(404).json({ error: 'Demande introuvable.' });

    res.json({ success: true, certification: cert, message: 'Demande refusée.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Révocation / retrait d'une certification par l'administrateur avec motif
apiRouter.post('/admin/stores/:id/revoke-certification', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Le motif du retrait de certification est obligatoire.' });
    }

    const store = await db.revokeCertification(req.params.id, req.user!.id, reason.trim());
    if (!store) return res.status(404).json({ error: 'Boutique introuvable.' });

    res.json({ success: true, store, message: 'Certification retirée de la boutique.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Historique des certifications d'une boutique pour l'admin
apiRouter.get('/admin/stores/:id/certification-history', requireAdmin, async (req, res) => {
  try {
    const history = await db.getStoreCertificationHistory(req.params.id);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// 12. FONCTIONNALITÉS D'INTELLIGENCE ARTIFICIELLE (MARKET SÉNÉGAL IA)
// -----------------------------------------------------------------------------

// Statut et disponibilité du service d'IA
apiRouter.get('/ai/status', (_req, res) => {
  const status = checkAiStatus();
  res.json(status);
});

// Assistant de discussion officiel MARKET SÉNÉGAL (Grounded sur les données réelles du catalogue)
apiRouter.post('/ai/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message requis.' });
    }

    const result = await chatWithAssistant(message.trim(), Array.isArray(history) ? history : []);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur assistant IA' });
  }
});

// Aide à la rédaction de brouillon dans une conversation (déclenché strictement à la demande)
apiRouter.post('/ai/draft-response', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, customInstruction } = req.body;
    if (!conversationId) {
      return res.status(400).json({ error: 'Identifiant de conversation requis.' });
    }

    const conv = await db.getConversationById(conversationId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }

    // Sécurité : l'utilisateur doit être participant à cette conversation (ou admin)
    const store = await db.getStoreById(conv.store_id);
    const isClient = conv.customer_id === req.user!.id;
    const isVendor = store && store.user_id === req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    if (!isClient && !isVendor && !isAdmin) {
      return res.status(403).json({ error: 'Vous ne faites pas partie de cette conversation.' });
    }

    const roleForPrompt: 'vendeur' | 'client' = isVendor ? 'vendeur' : 'client';
    const result = await draftConversationReply(conversationId, roleForPrompt, customInstruction);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur de génération du brouillon' });
  }
});

// Création d'illustration produit par IA pour les vendeurs
apiRouter.post('/ai/generate-product-image', requireSeller, async (req: AuthenticatedRequest, res) => {
  try {
    const store = await db.getStoreByUserId(req.user!.id);
    if (!store) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }

    const { productName, description, categoryName, referenceImageBase64, referenceImageMimeType } = req.body;
    if (!productName || !description) {
      return res.status(400).json({ error: 'Nom et description du produit requis pour générer une illustration.' });
    }

    const result = await generateProductIllustration({
      storeId: store.id,
      productName: productName.trim(),
      description: description.trim(),
      categoryName: categoryName?.trim(),
      referenceImageBase64,
      referenceImageMimeType
    });

    if (!result.available || result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création d’image' });
  }
});

// Configuration et quotas d'IA pour les administrateurs
apiRouter.get('/admin/ai-config', requireAdmin, async (_req, res) => {
  try {
    const config = db.getAiConfig();
    const status = checkAiStatus();
    res.json({ config, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/admin/ai-config', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { daily_quota_per_store, enabled } = req.body;
    const updated = await db.updateAiConfig({
      daily_quota_per_store: Number(daily_quota_per_store) || 25,
      enabled: Boolean(enabled)
    }, req.user!.id);
    res.json({ success: true, config: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


