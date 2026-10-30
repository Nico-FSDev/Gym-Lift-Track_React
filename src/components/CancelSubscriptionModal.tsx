import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  Gift, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  MessageSquare, 
  Loader2, 
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import { backButtonManager } from '../utils/backButtonManager';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CANCEL_REASONS = [
  { id: 'too_expensive', label: 'Too expensive / Looking to cut back on monthly expenses' },
  { id: 'not_using_ai', label: 'Not using the AI coaching or muscle scanner features enough' },
  { id: 'achieved_goals', label: 'Achieved my current fitness and muscle building goals' },
  { id: 'found_alternative', label: 'Switched to another fitness tracking app' },
  { id: 'tech_issues', label: 'Experienced technical issues or UI difficulty' },
  { id: 'other', label: 'Other reason' },
];

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({ isOpen, onClose }) => {
  const { dbUser, setPremiumStatus, cancelSubscription, applyRetentionDiscount } = useAuth();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [offerClaimed, setOfferClaimed] = useState<boolean>(false);
  const [cancellationComplete, setCancellationComplete] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    return backButtonManager.register('cancel-sub-modal', 100, () => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Check hidden retention eligibility: allowed once per year (365 days)
  const lastClaimed = dbUser?.lastRetentionDiscountClaimedAt;
  const isEligibleForOffer = !lastClaimed || (Date.now() - lastClaimed > ONE_YEAR_MS);

  const handleReasonNext = () => {
    if (!selectedReason) return;
    if (isEligibleForOffer) {
      setStep(2); // Go to retention discount offer
    } else {
      setStep(3); // Skip directly to final confirmation if offer was already claimed within 1 year
    }
  };

  const handleClaimOffer = async () => {
    setIsSubmitting(true);
    try {
      // Call backend route to apply retention discount
      const res = await apiFetch('/api/stripe/apply-retention-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUser?.uid,
          email: dbUser?.email,
          reason: selectedReason,
        })
      });
      const data = await res.json();
      
      // Update local and firestore user record
      if (applyRetentionDiscount) {
        await applyRetentionDiscount();
      }
      
      setOfferClaimed(true);
    } catch (error: any) {
      alert("Failed to apply discount: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancellation = async () => {
    setIsSubmitting(true);
    try {
      // Call backend Stripe cancellation endpoint
      const res = await apiFetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: dbUser?.uid,
          email: dbUser?.email,
          reason: selectedReason,
          feedback
        })
      });
      await res.json();

      // Perform cancellation in state/database
      if (cancelSubscription) {
        await cancelSubscription(selectedReason, feedback);
      } else {
        await setPremiumStatus(false);
      }

      setCancellationComplete(true);
    } catch (error: any) {
      alert("Cancellation error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    // Reset modal internal state on close
    setStep(1);
    setSelectedReason('');
    setFeedback('');
    setOfferClaimed(false);
    setCancellationComplete(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-gray-900 dark:text-white">
                {cancellationComplete ? 'Subscription Canceled' : 'Manage Subscription'}
              </h3>
              <p className="text-2xs text-gray-500 dark:text-slate-400 font-medium">
                Gym Lift Track Premium
              </p>
            </div>
          </div>
          <button 
            onClick={handleModalClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* CANCELLATION FINISHED STATE */}
          {cancellationComplete ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-gray-900 dark:text-white">
                  Subscription Canceled
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Your Gym Lift Track Premium subscription has been canceled and future recurring billing via Stripe has been stopped. You will retain free tier access with 5 weekly AI credits.
                </p>
              </div>
              <button
                onClick={handleModalClose}
                className="w-full py-3 bg-gray-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
              >
                Return to Profile
              </button>
            </div>
          ) : offerClaimed ? (
            /* RETENTION OFFER CLAIMED SUCCESS STATE */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
                <Gift size={32} />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-gray-900 dark:text-white">
                  20% Discount Activated! 🎉
                </h4>
                <p className="text-xs text-gray-600 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you for staying with us! Your 20% discount has been applied to your subscription for the next 3 months. Your unlimited AI coaching access remains fully active.
                </p>
              </div>
              <button
                onClick={handleModalClose}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Awesome, Continue Training!
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: CANCELLATION REASON SURVEY */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      We're sorry to see you go
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Please let us know why you are considering canceling your subscription:
                    </p>
                  </div>

                  <div className="space-y-2">
                    {CANCEL_REASONS.map((r) => (
                      <label 
                        key={r.id}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                          selectedReason === r.id 
                            ? 'border-amber-500 bg-amber-500/5 text-amber-900 dark:text-amber-300 ring-2 ring-amber-500/20' 
                            : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input 
                          type="radio"
                          name="cancelReason"
                          value={r.id}
                          checked={selectedReason === r.id}
                          onChange={() => setSelectedReason(r.id)}
                          className="w-4 h-4 text-amber-500 focus:ring-amber-500 border-gray-300"
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-2xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-slate-500 font-mono">
                      Additional Feedback (Optional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="What could we do better?"
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white resize-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleModalClose}
                      className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Keep Subscription
                    </button>
                    <button
                      type="button"
                      disabled={!selectedReason}
                      onClick={handleReasonNext}
                      className="px-5 py-2.5 bg-gray-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-bold text-xs rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <span>Continue</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: AUDIBLE / AMAZON RETENTION OFFER */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-amber-500/20 dark:via-orange-500/15 dark:to-transparent p-5 rounded-3xl border border-amber-500/30 text-center space-y-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-black bg-amber-500 text-white uppercase tracking-wider shadow-sm">
                      <Gift size={12} /> Exclusive Retention Offer
                    </div>
                    
                    <h4 className="text-xl font-black text-gray-900 dark:text-white">
                      Stay with us & Get 20% OFF!
                    </h4>
                    
                    <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                      We'd love to support your training journey. Enjoy <span className="font-bold text-amber-600 dark:text-amber-400">20% off for the next 3 months</span> to keep your unlimited AI coaches and muscle target scanners active at a special rate.
                    </p>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-200/50 dark:border-amber-900/50 flex items-center justify-around text-center">
                      <div>
                        <span className="text-2xs text-gray-400 line-through">$9.99 / mo</span>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">$7.99 / mo</p>
                      </div>
                      <div className="h-8 w-px bg-gray-200 dark:bg-slate-800" />
                      <div className="text-left">
                        <span className="text-2xs font-bold text-gray-500 dark:text-slate-400 block">3 Months Duration</span>
                        <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Cancel Anytime
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleClaimOffer}
                      disabled={isSubmitting}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-[1.01] active:scale-[0.99] text-white font-black text-xs rounded-2xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      <span>Claim 20% Discount & Keep Premium</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-2xs font-bold text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-1"
                    >
                      <ArrowLeft size={12} /> Back
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="text-xs font-semibold text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                    >
                      No thanks, continue to cancel
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: FINAL CONFIRMATION WINDOW */}
              {step === 3 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
                  <div className="bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 p-4 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                      <AlertTriangle size={18} />
                      <span>Confirm Cancellation</span>
                    </div>
                    <p className="text-xs text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                      If you proceed, your recurring Stripe payments will stop and your account will lose access to the following Premium benefits at the end of your billing cycle:
                    </p>
                  </div>

                  <div className="space-y-2.5 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                    <h5 className="text-2xs font-extrabold uppercase tracking-widest text-gray-400 font-mono">
                      Features You Will Lose
                    </h5>
                    <ul className="space-y-2 text-xs font-semibold text-gray-600 dark:text-slate-300">
                      <li className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <span>✕</span> Unlimited AI Biomechanical Coaching Recommendations
                      </li>
                      <li className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <span>✕</span> Gemini-powered Automatic Muscle Target Scans
                      </li>
                      <li className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <span>✕</span> High-fidelity Muscle & Movement Data Indexing
                      </li>
                      <li className="flex items-center gap-2 text-amber-600 dark:text-amber-400 pt-1 border-t border-gray-200 dark:border-slate-700">
                        <span>⚡</span> Reverts account to 5 free weekly AI credits
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmCancellation}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
                      <span>Confirm & Cancel Subscription</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleModalClose}
                      className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Nevermind, Keep My Subscription Active
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
