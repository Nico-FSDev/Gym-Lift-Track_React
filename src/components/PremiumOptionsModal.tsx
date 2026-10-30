import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Key, 
  Check, 
  ShieldAlert, 
  Loader2, 
  Zap, 
  CreditCard,
  CheckCircle2,
  Lock,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { apiFetch } from '../utils/api';
import { backButtonManager } from '../utils/backButtonManager';

interface PremiumOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

export const PremiumOptionsModal: React.FC<PremiumOptionsModalProps> = ({ isOpen, onClose, onNavigateToTab }) => {
  const { dbUser, saveGeminiApiKey, setPremiumStatus } = useAuth();

  const [apiKeyInput, setApiKeyInput] = useState(
    dbUser?.geminiApiKey || (typeof window !== 'undefined' ? window.localStorage.getItem('custom_gemini_api_key') || '' : '')
  );
  const [keySaving, setKeySaving] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || isCancelModalOpen) return;
    return backButtonManager.register('premium-modal', 90, () => {
      onClose();
      return true;
    });
  }, [isOpen, isCancelModalOpen, onClose]);

  if (!isOpen) return null;

  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem('custom_gemini_api_key') : null;
  const isPremium = !!dbUser?.isPremium || !!localKey;

  const handleSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    setKeySaving(true);
    setKeySaveMessage(null);
    try {
      window.localStorage.setItem('custom_gemini_api_key', trimmed);
      if (saveGeminiApiKey) {
        await saveGeminiApiKey(trimmed);
      }
      setKeySaveMessage('✓ Custom Gemini API Key saved! Unlimited AI coaching activated.');
    } catch (err: any) {
      alert('Failed to save API key: ' + err.message);
    } finally {
      setKeySaving(false);
    }
  };

  const handleClearKey = async () => {
    if (confirm('Are you sure you want to clear your custom Gemini API key?')) {
      window.localStorage.removeItem('custom_gemini_api_key');
      if (saveGeminiApiKey) {
        await saveGeminiApiKey('');
      }
      setApiKeyInput('');
      setKeySaveMessage('✓ Key cleared successfully.');
    }
  };

  const handleUpgradeStripe = async () => {
    setStripeLoading(true);
    try {
      const res = await apiFetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUser?.uid,
          email: dbUser?.email,
          appUrl: window.location.origin,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.isSimulated) {
        await setPremiumStatus(true);
        alert('🎉 Premium Elite Status activated! Enjoy unlimited AI coaching.');
        onClose();
      }
    } catch (err: any) {
      alert('Checkout error: ' + err.message);
    } finally {
      setStripeLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-all my-auto max-h-[90vh] flex flex-col">
          
          {/* Top Banner Header */}
          <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-6 text-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                <Sparkles size={28} className="fill-white" />
              </div>
              <div>
                <span className="text-2xs font-extrabold uppercase tracking-widest bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                  {isPremium ? 'Premium Elite Active' : 'Upgrade Account'}
                </span>
                <h3 className="text-xl font-black tracking-tight">
                  Gym Lift Track Premium Options
                </h3>
              </div>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1">

            {/* Current Status Badge */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              isPremium
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200'
            }`}>
              <div className="flex items-center gap-3">
                {isPremium ? (
                  <CheckCircle2 className="w-6 h-6 text-amber-500 shrink-0" />
                ) : (
                  <Zap className="w-6 h-6 text-sky-500 shrink-0 fill-sky-500" />
                )}
                <div>
                  <h4 className="font-bold text-sm">
                    {isPremium ? 'Unlimited AI Coaching & Scanning' : 'Free Tier Active (5 Weekly Credits)'}
                  </h4>
                  <p className="text-xs opacity-80 font-medium">
                    {isPremium
                      ? 'You have unrestricted access to all Gemini AI fitness and nutrition features.'
                      : 'Upgrade to Premium or bring your free Gemini API key to remove limit.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Premium Membership Card ($9.99/mo) */}
            <div className="bg-gradient-to-br from-gray-50 to-amber-50/30 dark:from-slate-800/80 dark:to-slate-800/40 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    Premium Membership Subscription
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                    Full turn-key experience managed directly via Stripe
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-gray-900 dark:text-white">$9.99</span>
                  <span className="text-2xs font-bold text-gray-400 block">/ month</span>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300 font-semibold">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" /> Unlimited AI Biomechanical Coaching & Fiber Analysis
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" /> AI Dietitian Coach & Tailored Goal Meals
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-amber-500 shrink-0" /> High-speed AI Photo Meal & Label Scanner
                </li>
              </ul>

              {!isPremium ? (
                <button
                  type="button"
                  onClick={handleUpgradeStripe}
                  disabled={stripeLoading}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-xl shadow-md shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  <span>Subscribe to Premium ($9.99/mo)</span>
                </button>
              ) : (
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Subscription Active
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(true)}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldAlert size={14} /> Manage or Cancel Subscription
                  </button>
                </div>
              )}
            </div>

            {/* Bring Your Own Gemini API Key (Free Unlimited Alternative) */}
            <div className="bg-gray-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-indigo-500" />
                  Bring Your Own Gemini API Key (Free)
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium leading-relaxed">
                  Have a Google AI Studio API key? Paste it below for 100% free, unlimited AI features without subscribing.
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Paste key here (AIzaSy...)"
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setKeySaveMessage(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500 dark:text-white"
                />

                {keySaveMessage && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {keySaveMessage}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    disabled={keySaving || !apiKeyInput.trim()}
                    className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs rounded-xl shadow transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {keySaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>Save Key</span>
                  </button>

                  {apiKeyInput && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="px-3 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                    >
                      Clear Key
                    </button>
                  )}
                </div>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
              >
                <span>Get a free API key at Google AI Studio</span>
                <ExternalLink size={12} />
              </a>
            </div>

          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* Cancel Subscription Sub-modal */}
      <CancelSubscriptionModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
      />
    </>
  );
};
