import React, { useState } from 'react';
import { X, Copy, Check, Share2, ExternalLink, Globe } from 'lucide-react';
import { formatFCFA } from '../api/client.js';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'store' | 'product';
  title: string;
  description?: string;
  imageUrl?: string;
  url: string;
  priceFcfa?: number;
  storeName?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  description,
  imageUrl,
  url,
  priceFcfa,
  storeName
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: description || (type === 'product' ? `Découvrez ${title} sur MARKET SÉNÉGAL` : `Visitez ${title} sur MARKET SÉNÉGAL`),
          url
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const getWhatsAppUrl = () => {
    const text = type === 'product'
      ? `🛍️ *${title}* ${priceFcfa ? `(${formatFCFA(priceFcfa)})` : ''}\n${description ? `${description.slice(0, 120)}...\n` : ''}\n👉 Voir et commander en ligne : ${url}`
      : `🏪 *${title}* sur MARKET SÉNÉGAL\n${description ? `${description.slice(0, 120)}...\n` : ''}\n👉 Visiter la boutique en ligne : ${url}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const getFacebookUrl = () => {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  };

  const domain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'marketsenegal.sn';
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {type === 'store' ? 'Partager ma boutique' : 'Partager ce produit'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Lien public stable prêt à être diffusé à vos clients
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Public Link Copy Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adresse publique officielle (stable)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2.5">
              Partager directement sur vos canaux
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <span className="text-sm">💬</span>
                Partager sur WhatsApp
              </a>

              <a
                href={getFacebookUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <span className="text-sm">📘</span>
                Partager sur Facebook
              </a>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full mt-2.5 p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-200"
              >
                <Share2 className="w-3.5 h-3.5" />
                Partager via les applications de mon appareil
              </button>
            )}
          </div>

          {/* Real-time Social Preview Card */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Aperçu de la carte lors du partage (WhatsApp & Réseaux sociaux)
              </span>
              <span className="text-[10px] text-slate-400">OpenGraph dynamique</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 shadow-xs hover:border-slate-300 transition-colors">
              {imageUrl ? (
                <div className="w-full h-44 bg-slate-200 overflow-hidden relative">
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {priceFcfa !== undefined && (
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 bg-slate-900/85 backdrop-blur-xs text-white text-xs font-bold rounded-lg">
                      {formatFCFA(priceFcfa)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-28 bg-gradient-to-r from-blue-700 via-indigo-700 to-amber-600 flex items-center justify-center text-white text-xs font-bold px-4 text-center">
                  {title}
                </div>
              )}

              <div className="p-3.5 bg-white">
                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 mb-1">
                  <Globe className="w-3 h-3 text-slate-400" />
                  <span>{domain}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 line-clamp-1 mb-1">
                  {title}
                </h4>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {description || 'Découvrez ce contenu exclusif sur MARKET SÉNÉGAL, le grand marché en ligne du Sénégal.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Tester l'adresse dans un nouvel onglet
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
