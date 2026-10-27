import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.js';

// Initialization of Google Gen AI with server-side API Key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

export interface AiStatus {
  available: boolean;
  provider: string;
  textModel: string;
  imageModel: string;
  reason?: string;
  dailyQuotaPerStore: number;
}

export function checkAiStatus(): AiStatus {
  const apiKey = process.env.GEMINI_API_KEY;
  const config = db.getAiConfig();

  if (!apiKey) {
    return {
      available: false,
      provider: config.provider || 'Google Gemini',
      textModel: 'gemini-3.8-flash',
      imageModel: 'gemini-3.1-flash-lite-image',
      reason: 'Clé API d’IA non configurée sur le serveur. Les fonctionnalités d’IA sont momentanément désactivées sans simulation.',
      dailyQuotaPerStore: config.daily_quota_per_store
    };
  }

  if (!config.enabled) {
    return {
      available: false,
      provider: config.provider || 'Google Gemini',
      textModel: 'gemini-3.8-flash',
      imageModel: 'gemini-3.1-flash-lite-image',
      reason: 'Le service d’IA est temporairement suspendu par l’administration de MARKET SÉNÉGAL.',
      dailyQuotaPerStore: config.daily_quota_per_store
    };
  }

  return {
    available: true,
    provider: config.provider || 'Google Gemini',
    textModel: 'gemini-3.8-flash',
    imageModel: 'gemini-3.1-flash-lite-image',
    dailyQuotaPerStore: config.daily_quota_per_store
  };
}

/**
 * 1. AI Chatbot Assistant for Market Sénégal
 * - Clearly identified as "IA de MARKET SÉNÉGAL" (never a seller or customer)
 * - Helps clients understand platform usage (orders, cart, 14 Senegalese regions, vendor vs client payments)
 * - Grounded strictly in real active in-stock products from DB (no fabricated products or false stock claims)
 */
export async function chatWithAssistant(
  userMessage: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<{ reply: string; available: boolean; error?: string }> {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      reply: '',
      available: false,
      error: status.reason || 'Service d’IA indisponible.'
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      reply: '',
      available: false,
      error: 'Client IA indisponible.'
    };
  }

  try {
    // Grounding: Fetch real active products with stock > 0
    const allProducts = await db.getProducts({ is_active: true });
    const inStockProducts = allProducts.filter(p => p.stock_quantity > 0).slice(0, 40);

    const catalogCatalogSummary = inStockProducts.map(p =>
      `- "${p.name}" (Prix: ${p.price_fcfa.toLocaleString('fr-FR')} FCFA, Boutique: "${p.store_name || 'Boutique'}", Ville: "${p.store_city || 'Sénégal'}", En stock: ${p.stock_quantity} unité(s)). Description: ${p.description.slice(0, 120)}`
    ).join('\n');

    const systemInstruction = `Tu es l'« IA de MARKET SÉNÉGAL », l'assistant officiel de la plateforme e-commerce multi-boutiques sénégalaise (https://marketsenegal.sn).
RÈGLES ABSOLUES ET STRICTES :
1. IDENTITÉ : Présente-toi et agis toujours comme l'« IA de MARKET SÉNÉGAL ». Tu ne dois JAMAIS te faire passer pour un vendeur, pour un client ou pour un être humain.
2. TÂCHES : 
   - Expliquer le fonctionnement du site : le panier multi-boutique, les livraisons fixées par chaque vendeur selon les régions (Dakar, Thiès, Saint-Louis, etc.), la différence entre paiements de commandes (qui se règlent selon les options activées par le vendeur) et abonnements professionnels des vendeurs (Wave Essentiel 8 000 FCFA, etc.).
   - Aider les clients à trouver un produit réel parmi la liste ci-dessous.
3. VÉRITÉ ET FIABILITÉ DES DONNÉES (GROUNDING STRICT) :
   - Tu n'affirmes JAMAIS qu'un produit est disponible ou en stock s'il n'est pas explicitement listé dans les DONNÉES RÉELLES ci-dessous.
   - N'invente aucun produit, aucun prix, aucune fausse garantie de livraison.
   - Si le client cherche un article qui ne figure pas dans cette liste, dis-lui poliment qu'aucun vendeur ne le propose actuellement en stock sur MARKET SÉNÉGAL.
4. TON : Chaleureux, courtois, professionnel, adapté au Sénégal (quelques mots usuels comme "Dalal ak jàmm" ou "Teranga" sont les bienvenus avec parcimonie). Monnaie : Franc CFA (FCFA).

DONNÉES RÉELLES DU CATALOGUE EN STOCK ACTUELLEMENT :
${catalogCatalogSummary || 'Aucun produit actuellement en stock dans le catalogue public.'}
`;

    // Construct conversation parts for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Append history (limit to last 6 messages to stay efficient)
    const recentHistory = history.slice(-6);
    for (const h of recentHistory) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }]
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
      }
    });

    const reply = response.text || 'Désolé, je ne peux pas formuler de réponse pour le moment.';
    await db.logAiUsage({ type: 'discussion_assistance' });

    return { reply, available: true };
  } catch (err: any) {
    console.error('[AI Chat] Erreur:', err);
    const rawMsg = err.message || '';
    const isOverloaded = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand');
    return {
      reply: '',
      available: false,
      error: isOverloaded
        ? 'Le modèle d’IA subit actuellement un pic temporaire de forte demande. Veuillez patienter quelques instants avant de relancer.'
        : `Service d’IA momentanément indisponible (${rawMsg.slice(0, 100)}).`
    };
  }
}

/**
 * 2. Draft Response Suggestion for Conversations
 * - Privacy protected: triggered strictly on-demand by the user (no background scanning)
 * - Returns a suggested draft that the user can review, edit, and send themselves
 * - Never sends automated messages
 */
export async function draftConversationReply(
  conversationId: string,
  userRole: 'vendeur' | 'client',
  customInstruction?: string
): Promise<{ draft: string; available: boolean; error?: string }> {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      draft: '',
      available: false,
      error: status.reason || 'Service d’IA indisponible.'
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      draft: '',
      available: false,
      error: 'Client d’IA non configuré.'
    };
  }

  try {
    const messages = await db.getMessagesByConversationId(conversationId);
    if (!messages || messages.length === 0) {
      return {
        draft: '',
        available: false,
        error: 'Aucun message dans cette conversation pour formuler une suggestion.'
      };
    }

    // Last 5 messages context for privacy and relevance
    const recentMessages = messages.slice(-5).map(m =>
      `${m.sender_id === 'vendeur' ? 'Vendeur' : 'Client'} : ${m.content}`
    ).join('\n');

    const roleName = userRole === 'vendeur' ? 'le vendeur' : 'le client';
    const otherRoleName = userRole === 'vendeur' ? 'le client' : 'le vendeur';

    const prompt = `Voici les derniers échanges d'une conversation sur MARKET SÉNÉGAL :
${recentMessages}

Consigne : Rédige une proposition de réponse polie, concise et bienveillante pour ${roleName} s'adressant à ${otherRoleName}.
${customInstruction ? `Instruction particulière de l'utilisateur : "${customInstruction}".` : ''}

RÈGLES IMPORTANTES :
1. N'affirme pas qu'un colis est déjà expédié ou garanti à telle date sans que ce soit explicitement dit.
2. Ne promets pas de remises ou de gratuité non convenues.
3. Rédige UNIQUEMENT le texte proposé du message (sans guillemets superflus, ni préambule, ni balises), prêt à être relu et modifié par l'utilisateur avant envoi.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "Tu es un assistant de rédaction courtois et professionnel pour la messagerie de MARKET SÉNÉGAL.",
        temperature: 0.5
      }
    });

    const draft = response.text?.trim() || '';
    await db.logAiUsage({ type: 'draft_suggestion' });

    return { draft, available: true };
  } catch (err: any) {
    console.error('[AI Draft] Erreur:', err);
    const rawMsg = err.message || '';
    const isOverloaded = rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand');
    return {
      draft: '',
      available: false,
      error: isOverloaded
        ? 'Le modèle d’IA subit actuellement un pic temporaire de forte demande. Veuillez réessayer dans quelques instants.'
        : `Service de suggestion d’IA momentanément indisponible.`
    };
  }
}

/**
 * 3. AI Product Image Generation for Sellers
 * - Generates presentation illustration from product name, description, category, and optional reference photo
 * - Preserves faithfully product attributes (shape, color, brand, labels)
 * - Saves result securely to /uploads/ with mandatory watermark/badge flag is_ai_generated
 * - Enforces store daily quota
 */
export async function generateProductIllustration(params: {
  storeId: string;
  productName: string;
  description: string;
  categoryName?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}): Promise<{
  url?: string;
  is_ai_generated: boolean;
  available: boolean;
  error?: string;
  quotaRemaining?: number;
}> {
  const status = checkAiStatus();
  if (!status.available) {
    return {
      available: false,
      is_ai_generated: false,
      error: status.reason || 'Générateur d’images IA indisponible.'
    };
  }

  // Quota check
  const usedToday = db.getStoreAiUsageToday(params.storeId);
  const maxQuota = status.dailyQuotaPerStore || 25;
  if (usedToday >= maxQuota) {
    return {
      available: false,
      is_ai_generated: false,
      error: `Quota journalier d'illustrations IA atteint (${usedToday}/${maxQuota} images créées aujourd'hui). Réessayez demain.`
    };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      available: false,
      is_ai_generated: false,
      error: 'Client IA indisponible.'
    };
  }

  try {
    const promptText = `Professional, ultra-clean commercial studio e-commerce presentation illustration of:
Product: "${params.productName}"
Category: "${params.categoryName || 'Général'}"
Product details: "${params.description}"
Environment: Pristine contemporary clean background, soft shadow, authentic product packaging and details, vibrant natural colors, professional catalog standards for African and Senegalese commerce. No distorted text, accurate shape and color.`;

    const parts: any[] = [];

    // If reference image provided, pass it to preserve product fidelity
    if (params.referenceImageBase64) {
      parts.push({
        inlineData: {
          mimeType: params.referenceImageMimeType || 'image/jpeg',
          data: params.referenceImageBase64
        }
      });
      parts.push({
        text: `Based strictly on the real product reference photo provided, generate an enhanced commercial catalog presentation illustration. Faithfully preserve the exact shape, color, brand name, label, and texture of the product. Do not distort the original product features.`
      });
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '1:1'
        }
      }
    });

    let generatedBase64: string | null = null;
    let mimeType = 'image/png';

    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'image/png';
          break;
        }
      }
    }

    if (!generatedBase64) {
      return {
        available: false,
        is_ai_generated: false,
        error: 'Le modèle n’a pas renvoyé d’image valide. Veuillez réajuster les critères et réessayer.'
      };
    }

    // Save image to public uploads
    const UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const ext = mimeType.includes('jpeg') ? '.jpg' : '.png';
    const filename = `ai_illustration_${Date.now()}_${params.storeId.substring(0, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    fs.writeFileSync(filePath, Buffer.from(generatedBase64, 'base64'));
    const url = `/uploads/${filename}`;

    // Log usage
    await db.logAiUsage({
      store_id: params.storeId,
      type: 'image_generation'
    });

    const newUsed = usedToday + 1;

    return {
      url,
      is_ai_generated: true,
      available: true,
      quotaRemaining: Math.max(0, maxQuota - newUsed)
    };
  } catch (err: any) {
    console.error('[AI Image Gen] Erreur:', err);
    return {
      available: false,
      is_ai_generated: false,
      error: `Erreur lors de la génération d'image : ${err.message || 'Échec du service'}`
    };
  }
}
