import React, { useState, useEffect } from 'react';
import { useAuth, getCreditResetCountdown } from '../hooks/useAuth';
import { Zap, Clock, Sparkles, ChevronRight, Check, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PremiumOptionsModal } from './PremiumOptionsModal';

interface CreditTrackerBadgeProps {
  onNavigateToTab?: (tabId: string) => void;
  className?: string;
  compact?: boolean;
}

export default function CreditTrackerBadge({ onNavigateToTab, className = '', compact = false }: CreditTrackerBadgeProps) {
  const { dbUser } = useAuth();
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPremiumOptionsModal, setShowPremiumOptionsModal] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Update timer every minute for live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
  const isPremium = !!dbUser?.isPremium || !!localKey;

  // Render Premium symbol icon button if user is Premium/Admin or has custom API key
  if (isPremium) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowPremiumOptionsModal(true)}
          className={`group p-2 rounded-xl transition-all cursor-pointer border bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:scale-105 active:scale-95 shadow-2xs flex items-center justify-center ${className}`}
          title="Premium Options Active - Click to manage Premium & AI settings"
        >
          <Sparkles className="w-5 h-5 fill-amber-500 text-amber-500 group-hover:rotate-12 transition-transform" />
        </button>

        <PremiumOptionsModal
          isOpen={showPremiumOptionsModal}
          onClose={() => setShowPremiumOptionsModal(false)}
          onNavigateToTab={onNavigateToTab}
        />
      </>
    );
  }

  const currentUses = dbUser?.premiumUses ?? 0;
  const remaining = Math.max(0, 5 - currentUses);
  const resetCountdown = getCreditResetCountdown(dbUser?.premiumUsesResetAt);

  return (
    <>
      {/* Discrete Badge */}
      <button
        type="button"
        onClick={() => setShowPremiumOptionsModal(true)}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border shadow-2xs hover:scale-[1.02] active:scale-[0.98] ${
          remaining > 0
            ? 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-200 border-sky-200 dark:border-sky-800'
            : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse'
        } ${className}`}
        title={`Free Tier: ${remaining} of 5 weekly AI credits remaining. Click to view Premium Options.`}
      >
        <div className="flex items-center gap-1">
          <Zap className={`w-3.5 h-3.5 ${remaining > 0 ? 'text-sky-500 fill-sky-500' : 'text-rose-500 fill-rose-500'}`} />
          <span>{remaining}/5 credits</span>
        </div>

        {!compact && (
          <div className="hidden sm:flex items-center gap-1 pl-1.5 border-l border-sky-200 dark:border-sky-800/80 text-[10px] font-semibold opacity-90">
            <Clock className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>Reset {resetCountdown.formatted}</span>
          </div>
        )}

        <ChevronRight className="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Premium Options Modal */}
      <PremiumOptionsModal
        isOpen={showPremiumOptionsModal}
        onClose={() => setShowPremiumOptionsModal(false)}
        onNavigateToTab={onNavigateToTab}
      />
    </>
  );
}

