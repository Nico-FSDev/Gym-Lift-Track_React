import React, { useState, useEffect } from 'react';
import { Bug, X, Send, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { consoleLogger } from '../utils/consoleLogger';
import { getActiveSessionId } from '../utils/sessionManager';
import { backButtonManager } from '../utils/backButtonManager';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Workout Logging');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    return backButtonManager.register('bug-report-modal', 100, () => {
      onClose();
      return true;
    });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const recentLogs = consoleLogger.getLogs().slice(-10);
      const user = auth.currentUser;

      const reportPayload = {
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        status: 'open',
        userEmail: user?.email || 'Anonymous',
        userId: user?.uid || null,
        sessionId: getActiveSessionId(),
        errorConditionLogs: recentLogs,
        systemInfo: {
          userAgent: navigator.userAgent,
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          online: navigator.onLine,
        },
        createdAt: Timestamp.now(),
      };

      await addDoc(collection(db, 'bug_reports'), reportPayload);

      // Register into pipeline
      consoleLogger.addBugReportError(title.trim(), description.trim());

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setTitle('');
        setDescription('');
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Failed to submit bug report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Bug size={18} />
            <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
              Report an Issue / Bug
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-2 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <Check size={24} strokeWidth={3} />
            </div>
            <h5 className="font-extrabold text-sm text-gray-900 dark:text-white">Bug Report Dispatched</h5>
            <p className="text-xs text-gray-500">
              Your report and recent session error telemetry have been safely recorded in the central diagnostic pipeline.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <p className="text-xs text-gray-500 leading-relaxed">
              Encountered a problem or visual glitch? Describe what happened. Your recent diagnostic logs will automatically accompany this report to help the team resolve it swiftly.
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                Issue Summary
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Set reps not saving on Leg Extension"
                className="w-full text-xs font-bold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs font-bold py-2 px-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                >
                  <option value="Workout Logging">Workout Logging</option>
                  <option value="3D Anatomical Avatar">3D Avatar</option>
                  <option value="Sync & Cloud">Cloud & Sync</option>
                  <option value="Machine Config">Machine Config</option>
                  <option value="UI & Visuals">UI & Visuals</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="w-full text-xs font-bold py-2 px-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                >
                  <option value="low">Low - Minor</option>
                  <option value="medium">Medium - Inconvenient</option>
                  <option value="high">High - Feature Blocked</option>
                  <option value="critical">Critical - Crash</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                Description of what happened
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what action you performed and what went wrong..."
                className="w-full text-xs font-medium py-2 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs font-extrabold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
