import React, { useState } from 'react';
import { ShieldCheck, Check, Mail, Phone, MapPin, Send, HelpCircle, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const PricingView: React.FC = () => {
  const { navigate, user, store, openAuth } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
          Modèle 100% Transparent
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          0 % de commission sur toutes vos ventes
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          Sur MARKET SÉNÉGAL, vous ne reversez aucun pourcentage sur votre chiffre d'affaires. Choisissez le forfait mensuel adapté à la taille de votre activité.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Essentiel */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Forfait Essentiel</h2>
              <p className="text-xs text-slate-500 mt-1">L'essentiel pour vendre en ligne et livrer au Sénégal</p>
            </div>

            <div className="text-3xl font-extrabold text-slate-900 tabular-nums">
              8 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
            </div>

            <ul className="text-xs text-slate-600 space-y-3 pt-6 border-t border-slate-100">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Gestion complète de votre boutique et de vos commandes</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Publication illimitée de produits avec photos et stocks</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Configuration de vos zones et tarifs de livraison régionaux</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Messagerie directe avec les clients</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>0 % de commission sur les ventes</strong></span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              if (!user) openAuth('register');
              else if (store) navigate('vendor-dashboard', { tab: 'subscription' });
              else navigate('client-dashboard', { tab: 'create-store' });
            }}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
          >
            {store ? 'Gérer mon forfait' : 'Démarrer avec Essentiel'}
          </button>
        </div>

        {/* Croissance */}
        <div className="bg-white rounded-3xl p-8 border-2 border-orange-500 shadow-md space-y-6 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-orange-100 text-orange-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
            Recommandé
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Forfait Croissance</h2>
              <p className="text-xs text-slate-500 mt-1">Outils avancés pour accélérer vos ventes et fidéliser</p>
            </div>

            <div className="text-3xl font-extrabold text-orange-600 tabular-nums">
              18 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
            </div>

            <ul className="text-xs text-slate-600 space-y-3 pt-6 border-t border-slate-100">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span><strong>Toutes les fonctionnalités du forfait Essentiel</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>Statistiques avancées des ventes et analyse des tendances</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>Création de promotions et codes de réduction personnalisés</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>Exportation des commandes en format Excel et CSV</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>Mise en avant prioritaire de vos produits sur l'accueil</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span>Assistance dédiée et support prioritaire 7j/7</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => {
              if (!user) openAuth('register');
              else if (store) navigate('vendor-dashboard', { tab: 'subscription' });
              else navigate('client-dashboard', { tab: 'create-store' });
            }}
            className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
          >
            {store ? 'Passer à Croissance' : 'Choisir le forfait Croissance'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const HelpView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Centre d'aide & Questions fréquentes</h1>
        <p className="text-xs text-slate-500 mt-1">Tout ce qu'il faut savoir sur MARKET SÉNÉGAL</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Comment fonctionne la livraison ?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sur MARKET SÉNÉGAL, chaque vendeur configure librement ses propres zones et tarifs de livraison selon les 14 régions du Sénégal. Lors de votre commande, le montant exact des frais est affiché en amont. Le vendeur prépare et expédie le colis directement à votre adresse.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Que signifie 0% de commission sur les ventes ?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Contrairement aux intermédiaires classiques, MARKET SÉNÉGAL ne prélève aucun pourcentage sur le prix de vos articles. Le vendeur perçoit 100% de la valeur de sa vente, sans frais cachés.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Comment payer ma commande ?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Le mode principal actuellement actif est le <strong>Paiement en espèces à la livraison</strong>. Les passerelles de paiement direct par Wave et Orange Money sont en cours d'intégration technique et seront déployées dès finalisation des clés API officielles marchandes.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
          <h3 className="text-sm font-bold text-slate-900">Comment contacter une boutique ?</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Vous disposez d'un bouton « Contacter le vendeur » directement accessible sur chaque fiche produit et page boutique pour échanger par message sécurisé avant ou après votre achat.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ContactView: React.FC = () => {
  const [sent, setSent] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contactez la direction MARKET SÉNÉGAL</h1>
        <p className="text-xs text-slate-500 mt-1">Notre équipe support est basée à Dakar et vous accompagne au quotidien.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <MapPin className="w-5 h-5 text-orange-600" />
          <h4 className="font-bold text-slate-900">Siège</h4>
          <p className="text-slate-500">Dakar, Sénégal</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <Phone className="w-5 h-5 text-blue-600" />
          <h4 className="font-bold text-slate-900">Téléphone</h4>
          <p className="text-slate-500">+221 33 800 00 00</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
          <Mail className="w-5 h-5 text-emerald-600" />
          <h4 className="font-bold text-slate-900">Email</h4>
          <p className="text-slate-500">contact@marketsenegal.com</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Envoyer un message</h3>
        {sent ? (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs">
            Votre message a bien été transmis. Notre équipe vous répondra sous 24h.
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); setSent(true); }} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Votre nom</label>
                <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Votre téléphone</label>
                <input required type="tel" className="w-full p-2.5 border border-slate-300 rounded-xl" />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Votre email</label>
              <input required type="email" className="w-full p-2.5 border border-slate-300 rounded-xl" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Message</label>
              <textarea required rows={4} className="w-full p-2.5 border border-slate-300 rounded-xl" />
            </div>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">
              Envoyer ma demande
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const TermsView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 text-xs text-slate-700 leading-relaxed">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Conditions Générales d'Utilisation (CGU)</h1>
      <p className="text-slate-500">Dernière mise à jour : 25 Octobre 2026</p>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">1. Objet de la plateforme</h2>
        <p>MARKET SÉNÉGAL (accessible via marketsenegal.com) est une place de marché en ligne permettant la mise en relation directe entre des acheteurs et des vendeurs indépendants situés sur le territoire sénégalais.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">2. Règle du 0% de commission</h2>
        <p>MARKET SÉNÉGAL ne prélève aucune commission sur le montant des transactions conclues entre acheteurs et vendeurs. Le vendeur reçoit le prix net de ses articles sous réserve des frais de livraison expressément affichés.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">3. Responsabilité des vendeurs</h2>
        <p>Chaque boutique est juridiquement responsable de l'exactitude de ses descriptifs, de la conformité de ses articles et de l'exécution de la livraison dans les délais indiqués.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">4. Modération et suspension</h2>
        <p>La direction de MARKET SÉNÉGAL se réserve le droit de suspendre toute boutique contrevenant aux règles déontologiques, à la législation sénégalaise ou aux normes de qualité du service.</p>
      </section>
    </div>
  );
};

export const PrivacyView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 text-xs text-slate-700 leading-relaxed">
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Politique de Confidentialité</h1>
      <p className="text-slate-500">Conforme aux directives de la Commission de Protection des Données Personnelles (CDP) du Sénégal</p>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">1. Données collectées</h2>
        <p>Nous collectons uniquement les informations indispensables au bon acheminement des commandes : nom complet, numéro de téléphone de contact et adresse de livraison au Sénégal.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">2. Utilisation des données</h2>
        <p>Vos coordonnées sont transmises exclusivement à la boutique auprès de laquelle vous avez passé commande afin d'assurer l'expédition et le suivi logistique.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-900">3. Sécurité</h2>
        <p>Toutes les communications transitent via des canaux sécurisés HTTPS avec chiffrement SSL/TLS. Les mots de passe sont hachés de manière irréversible.</p>
      </section>
    </div>
  );
};
