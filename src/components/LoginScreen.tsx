import React, { useState } from 'react';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';
import Logo from './Logo';
import { performGoogleSignIn } from '../lib/auth';

interface LoginScreenProps {
  onSuccess?: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);

    try {
      const userCred = await performGoogleSignIn();
      if (userCred && onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('[LoginScreen] Sign-In error:', err);
      // Only display non-cancellation errors
      const msg = err?.message || 'Authentication failed. Please try again.';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="max-w-sm w-full space-y-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="space-y-4">
          <div className="w-32 h-32 mx-auto flex items-center justify-center filter drop-shadow-2xl transition-transform hover:scale-110 duration-300">
            <Logo size={128} className="w-full h-full" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white transition-colors">
            Gym Lift Track
          </h1>
          <p className="text-lg text-gray-500 dark:text-slate-400 font-medium transition-colors">
            Your personal strength journey, simplified.
          </p>
        </div>

        {authError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex flex-col gap-2 text-red-600 dark:text-red-400 text-sm text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="font-semibold">{authError}</span>
            </div>
            {authError.includes('Code 10') && (
              <div className="text-xs text-red-500/90 dark:text-red-400/90 pl-7 space-y-1">
                <p>To enable native Google Sign-In for the APK:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-gray-700 dark:text-slate-300">
                  <li>Go to your Firebase Console &gt; Project Settings</li>
                  <li>Under &quot;Your apps&quot;, select the Android app</li>
                  <li>Add your APK&apos;s SHA-1 certificate fingerprint</li>
                </ol>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black px-6 py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-gray-300/50 dark:shadow-none disabled:opacity-50 cursor-pointer"
        >
          {isSigningIn ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <LogIn size={24} />
              Continue with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
