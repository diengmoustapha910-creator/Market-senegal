import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Brain, MessageSquare, Send, X, Bot, Sparkles, AlertCircle,
  HelpCircle, ShoppingBag, Truck, Info, RefreshCw
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export const AiChatAssistant: React.FC = () => {
  const { navigate } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Dalal ak jàmm ! Je suis l'IA de MARKET SÉNÉGAL, l'assistant officiel de la plateforme. Je suis là pour vous expliquer le fonctionnement du site (commandes, panier multi-boutiques, livraisons dans les 14 régions du Sénégal) et vous aider à trouver des articles réels actuellement en stock dans notre catalogue. En quoi puis-je vous orienter aujourd'hui ?",
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; reason?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await apiFetch<any>('/ai/status');
      setAiStatus(res);
    } catch {
      setAiStatus({ available: false, reason: 'Service momentanément inaccessible.' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    if (aiStatus && !aiStatus.available) {
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history for API
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, text: m.text }));

      const res = await apiFetch<{ reply: string; available: boolean; error?: string }>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, history })
      });

      if (!res.available || res.error) {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: res.error || "Le service d'assistance par IA est momentanément indisponible. Aucune fausse réponse n'est générée.",
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: res.reply,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: `Le service d'assistance par IA est temporairement indisponible (${err.message || 'erreur réseau'}).`,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "Comment fonctionne la livraison selon les régions ?",
    "Quels sont les produits actuellement disponibles ?",
    "Comment commander plusieurs produits dans un seul panier ?",
    "Quelle est la différence entre commande client et abonnement vendeur ?"
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 z-40 bg-gradient-to-r from-indigo-600 via-indigo-700 to-amber-600 text-white rounded-full p-3.5 sm:px-4 sm:py-3 shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2.5 border-2 border-white/20 group cursor-pointer"
          aria-label="Ouvrir l'assistant IA de MARKET SÉNÉGAL"
        >
          <div className="relative">
            <Brain className="w-5 h-5 text-amber-300 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-white" />
          </div>
          <span className="hidden sm:inline text-xs font-bold tracking-tight">
            IA de MARKET SÉNÉGAL
          </span>
        </button>
      )}

      {/* Slide-out / Floating Chat Window */}
      {isOpen && (
        <div className="fixed bottom-4 left-4 z-50 w-[94vw] sm:w-[420px] max-w-[95vw] h-[580px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between border-b border-indigo-900/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-amber-300">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">IA de MARKET SÉNÉGAL</h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Officiel
                  </span>
                </div>
                <p className="text-[10px] text-slate-300">Assistant catalogue et aide à la navigation</p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Identification & Disclaimer Banner */}
          <div className="bg-amber-50 px-3.5 py-2 border-b border-amber-100 flex items-start gap-2 text-[10px] text-amber-900">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>Identification IA :</strong> Je suis un agent conversationnel automatisé (ni un vendeur, ni un client). Mes recommandations s'appuient uniquement sur les produits réels disponibles.
            </p>
          </div>

          {/* Unconfigured state warning */}
          {aiStatus && !aiStatus.available && (
            <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-start gap-2 text-[10px] text-slate-700">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-snug">
                Le module d'intelligence artificielle est momentanément désactivé (clé API non configurée). Aucun résultat simulé n'est affiché.
              </p>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-50/50">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                    {!isUser ? (
                      <span className="font-bold text-indigo-700 flex items-center gap-1">
                        <Bot className="w-3 h-3 text-indigo-600" /> IA MARKET SÉNÉGAL
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-600">Vous</span>
                    )}
                    <span>· {m.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-amber-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-indigo-600 text-xs py-2 bg-indigo-50/60 px-3 rounded-xl border border-indigo-100/60 max-w-fit">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>L'IA consulte le catalogue en temps réel...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions if chat is short */}
          {messages.length <= 3 && (
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-slate-400 shrink-0 font-medium text-[10px]">Suggestions :</span>
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={loading || (aiStatus !== null && !aiStatus.available)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg whitespace-nowrap transition-colors border border-slate-200 shrink-0 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                aiStatus && !aiStatus.available
                  ? "Service d'IA momentanément indisponible"
                  : "Posez votre question ou cherchez un produit..."
              }
              disabled={loading || (aiStatus !== null && !aiStatus.available)}
              className="flex-1 py-2 px-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || (aiStatus !== null && !aiStatus.available)}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors shrink-0 shadow-xs cursor-pointer"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
