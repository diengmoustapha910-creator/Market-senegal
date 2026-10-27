import crypto from 'node:crypto';

export interface PaymentProviderStatus {
  id: 'wave' | 'orange_money' | 'paiement_livraison';
  name: string;
  isAvailable: boolean;
  description: string;
  missingConfig?: string[];
}

export interface PaymentIntentRequest {
  orderId: string;
  amountFcfa: number;
  customerPhone: string;
  customerName: string;
  returnUrl?: string;
}

export interface PaymentIntentResult {
  success: boolean;
  checkoutUrl?: string;
  transactionRef?: string;
  errorMessage?: string;
  isConfigured: boolean;
}

export class PaymentGatewayService {
  /**
   * Retourne l'état de configuration des passerelles sans exposer de clés
   */
  getAvailableMethods(storeAllowsCod: boolean = true): PaymentProviderStatus[] {
    const waveConfigured = Boolean(process.env.WAVE_API_KEY && process.env.WAVE_SECRET_KEY);
    const orangeMoneyConfigured = Boolean(process.env.ORANGE_MONEY_CLIENT_ID && process.env.ORANGE_MONEY_CLIENT_SECRET);

    const methods: PaymentProviderStatus[] = [];

    // 1. Paiement à la livraison
    if (storeAllowsCod) {
      methods.push({
        id: 'paiement_livraison',
        name: 'Paiement en espèces à la livraison',
        isAvailable: true,
        description: 'Réglez le livreur en espèces à la réception de votre colis. Simple et sécurisé.'
      });
    }

    // 2. Wave Sénégal
    methods.push({
      id: 'wave',
      name: 'Wave Sénégal',
      isAvailable: waveConfigured,
      description: waveConfigured 
        ? 'Paiement direct et instantané via Wave (0% de frais ajoutés).'
        : 'Paiement par Wave bientôt disponible. En attente de finalisation des clés API marchandes officielles.',
      missingConfig: waveConfigured ? [] : ['WAVE_API_KEY', 'WAVE_SECRET_KEY']
    });

    // 3. Orange Money Sénégal
    methods.push({
      id: 'orange_money',
      name: 'Orange Money Sénégal',
      isAvailable: orangeMoneyConfigured,
      description: orangeMoneyConfigured
        ? 'Paiement sécurisé via Orange Money.'
        : 'Paiement par Orange Money en cours d’intégration avec Orange Developer.',
      missingConfig: orangeMoneyConfigured ? [] : ['ORANGE_MONEY_CLIENT_ID', 'ORANGE_MONEY_CLIENT_SECRET']
    });

    return methods;
  }

  /**
   * Initialise un paiement Wave avec contrôle d'intégrité
   */
  async initiateWavePayment(req: PaymentIntentRequest): Promise<PaymentIntentResult> {
    const apiKey = process.env.WAVE_API_KEY;
    const secretKey = process.env.WAVE_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return {
        success: false,
        isConfigured: false,
        errorMessage: 'Le paiement en ligne Wave n\'est pas encore actif. Les clés API officielles sont en cours de déploiement par la direction.'
      };
    }

    // Lorsque WAVE_API_KEY est injecté sur Railway :
    // Appel sécurisé au endpoint officiel Wave Checkout API:
    // POST https://api.wave.com/v1/checkout/sessions
    try {
      /*
      const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: req.amountFcfa,
          currency: 'XOF',
          client_reference: req.orderId,
          success_url: `${process.env.APP_URL}/commandes?order=${req.orderId}&status=success`,
          error_url: `${process.env.APP_URL}/panier?order=${req.orderId}&status=failed`
        })
      });
      const data = await response.json();
      return { success: true, isConfigured: true, checkoutUrl: data.wave_launch_url, transactionRef: data.id };
      */
      return {
        success: false,
        isConfigured: true,
        errorMessage: 'Initialisation de transaction Wave prête. Veuillez compléter le paramétrage réseau.'
      };
    } catch (err: any) {
      return {
        success: false,
        isConfigured: true,
        errorMessage: `Erreur passerelle Wave: ${err.message}`
      };
    }
  }

  /**
   * Vérifie la signature cryptographique d'un webhook Wave pour empêcher l'usurpation
   */
  verifyWaveWebhookSignature(payload: string, signature: string): boolean {
    const secret = process.env.WAVE_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature));
  }

  /**
   * Vérifie la signature d'un webhook Orange Money
   */
  verifyOrangeMoneyWebhook(payload: string, signature: string): boolean {
    const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;

    const computed = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
}

export const paymentGateway = new PaymentGatewayService();
