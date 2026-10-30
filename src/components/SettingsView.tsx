import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from './ThemeProvider';
import { QrCode, MonitorSmartphone, Settings as SettingsIcon, Database, AlertTriangle, ShieldAlert, Cpu, Sparkles, BrainCircuit, Check, Loader2, Play, Bug } from 'lucide-react';
import CsvImporter from './CsvImporter';
import Dropdown from './Dropdown';
import { MachineConfig, WorkoutSet } from '../types';
import { MACHINES } from './MachineList';
import { useAuth, getCreditResetCountdown } from '../hooks/useAuth';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import BugReportModal from './BugReportModal';
import { apiFetch } from '../utils/api';
import { fetchAiMuscleLookup } from '../services/aiService';

interface SettingsViewProps {
  importCSV: (csvText: string) => Promise<{ success: boolean; setsCount: number; configsCount: number }>;
  setsCount: number;
  onWipeAll: () => Promise<void>;
  repairFlippedDates?: () => Promise<number>;
  applyPresetsToExistingMachines?: () => Promise<number>;
  machineConfigs?: MachineConfig[];
  sets?: WorkoutSet[];
  saveMachineConfig?: (
    exercise: string, 
    baseWeightLbs: number, 
    baseWeightKg: number,
    brand?: string,
    category?: string,
    variantCategories?: Record<string, string>,
    type?: 'Machine' | 'Weightlifting' | 'Exercise',
    oldExercise?: string,
    linkedMuscles?: string[],
    linkedGroups?: string[],
    customFields?: string[],
    invertWeight?: boolean,
    invertBaseWeight?: boolean,
    postures?: {name: string, weightModifier: number}[]
  ) => Promise<void>;
  saveMachineConfigsBatch?: (
    configs: Array<{
      exercise: string;
      baseWeightLbs?: number;
      baseWeightKg?: number;
      brand?: string;
      category?: string;
      variantCategories?: Record<string, string>;
      type?: 'Machine' | 'Weightlifting' | 'Exercise';
      linkedMuscles?: string[];
      linkedGroups?: string[];
      customFields?: string[];
    }>
  ) => Promise<void>;
}

export default function SettingsView({ 
  importCSV, 
  setsCount, 
  onWipeAll, 
  repairFlippedDates, 
  applyPresetsToExistingMachines,
  machineConfigs = [],
  sets = [],
  saveMachineConfig,
  saveMachineConfigsBatch
}: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const { dbUser, saveGeminiApiKey, setPremiumStatus, incrementPremiumUses } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'webapp' | 'trainingOptions'>('general');
  const [wipeLoading, setWipeLoading] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairMessage, setRepairMessage] = useState<string | null>(null);

  // AI-powered muscle scan states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0 });
  const [singleScanLoading, setSingleScanLoading] = useState<Record<string, boolean>>({});
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);

  const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
  const isPremium = !!dbUser?.isPremium || !!dbUser?.geminiApiKey || !!localKey;

  // Compile a clean list of all exercises combining default and custom ones
  const allExercises = useMemo(() => {
    const defaultNames = MACHINES.map(m => m.name);
    const customNamesFromSets = sets ? sets.map(s => s.exercise) : [];
    const customNamesFromConfigs = machineConfigs ? machineConfigs.map(c => c.exercise) : [];
    
    const uniqueNames = Array.from(new Set([...defaultNames, ...customNamesFromSets, ...customNamesFromConfigs]))
      .filter(name => name && name.trim() !== '');

    return uniqueNames.map(name => {
      const config = machineConfigs ? machineConfigs.find(c => c.exercise.toLowerCase() === name.toLowerCase()) : undefined;
      const defaultMachine = MACHINES.find(m => m.name.toLowerCase() === name.toLowerCase());
      
      return {
        name,
        category: config?.category || defaultMachine?.category || 'Custom',
        type: config?.type || defaultMachine?.type || 'Machine',
        brand: config?.brand || 'Standard',
        baseWeightLbs: config?.baseWeightLbs || 0,
        baseWeightKg: config?.baseWeightKg || 0,
        linkedMuscles: config?.linkedMuscles || [],
        linkedGroups: config?.linkedGroups || [],
        config
      };
    });
  }, [sets, machineConfigs]);

  const runAiMuscleScan = async (overwriteAll: boolean) => {
    if (!saveMachineConfig) return;
    
    const currentUses = dbUser?.premiumUses ?? 0;
    const hasPremiumAccess = isPremium || currentUses < 5;
    if (!hasPremiumAccess) {
      const countdown = getCreditResetCountdown(dbUser?.premiumUsesResetAt);
      setAiLogs(prev => [
        ...prev, 
        `⚡ Free Weekly AI Credits Reached (5/5). Credits reset in ${countdown.formatted}.`
      ]);
      return;
    }

    if (!isPremium) {
      try {
        await incrementPremiumUses();
      } catch (err) {
        console.error("Failed to increment usage count:", err);
      }
    }

    setAiLoading(true);
    setAiLogs(["Initializing AI Muscle Scanner..."]);
    setAiProgress({ current: 0, total: 0 });

    try {
      const targetExercises = allExercises.filter(ex => {
        if (overwriteAll) return true;
        return ex.linkedMuscles.length === 0;
      });

      if (targetExercises.length === 0) {
        setAiLogs(prev => [...prev, "✓ No exercises require scanning. Everything is already mapped!"]);
        setAiLoading(false);
        return;
      }

      setAiProgress({ current: 0, total: targetExercises.length });
      setAiLogs(prev => [...prev, `Found ${targetExercises.length} exercises to analyze.`]);

      const chunkSize = 5;
      const customKey = (typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null) || dbUser?.geminiApiKey || "";

      for (let i = 0; i < targetExercises.length; i += chunkSize) {
        const chunk = targetExercises.slice(i, i + chunkSize);
        const namesToQuery = chunk.map(ex => ex.name);

        setAiLogs(prev => [...prev, `[AI] Researching: ${namesToQuery.join(', ')}...`]);

        const data = await fetchAiMuscleLookup(namesToQuery, customKey);
        const results = data.results || [];

        const batchItemsToSave: Array<{
          exercise: string;
          baseWeightLbs?: number;
          baseWeightKg?: number;
          brand?: string;
          category?: string;
          variantCategories?: Record<string, string>;
          type?: 'Machine' | 'Weightlifting' | 'Exercise';
          linkedMuscles?: string[];
          linkedGroups?: string[];
          customFields?: string[];
        }> = [];

        for (const res of results) {
          const originalExercise = targetExercises.find(ex => 
            ex.name.trim().toLowerCase() === res.exerciseName.trim().toLowerCase() ||
            ex.name.trim().toLowerCase().includes(res.exerciseName.trim().toLowerCase()) ||
            res.exerciseName.trim().toLowerCase().includes(ex.name.trim().toLowerCase())
          );
          if (!originalExercise) continue;

          setAiLogs(prev => [
            ...prev, 
            `[AI] Detected muscles for '${res.exerciseName}': ${res.muscles.join(', ')} (${res.groups.join(', ')})`
          ]);

          batchItemsToSave.push({
            exercise: originalExercise.name,
            baseWeightLbs: originalExercise.baseWeightLbs,
            baseWeightKg: originalExercise.baseWeightKg,
            brand: originalExercise.brand,
            category: originalExercise.category,
            variantCategories: originalExercise.config?.variantCategories,
            type: originalExercise.type,
            linkedMuscles: res.muscles,
            linkedGroups: res.groups,
            customFields: originalExercise.config?.customFields,
          });
        }

        if (batchItemsToSave.length > 0) {
          if (saveMachineConfigsBatch) {
            await saveMachineConfigsBatch(batchItemsToSave);
          } else {
            for (const item of batchItemsToSave) {
              await saveMachineConfig(
                item.exercise,
                item.baseWeightLbs ?? 0,
                item.baseWeightKg ?? 0,
                item.brand,
                item.category,
                item.variantCategories,
                item.type,
                undefined,
                item.linkedMuscles,
                item.linkedGroups
              );
            }
          }
          setAiProgress(prev => ({ ...prev, current: Math.min(prev.total, prev.current + batchItemsToSave.length) }));
        }
      }

      setAiLogs(prev => [...prev, "✓ AI Muscle Attachment complete! All exercises successfully linked in the database."]);
    } catch (err: any) {
      console.error(err);
      if (err.message === "GEMINI_API_KEY_MISSING") {
        setAiLogs(prev => [
          ...prev, 
          "❌ Error: Gemini API Key is missing. Please configure your personal key under Profile > Account Settings to run AI scans!"
        ]);
      } else {
        setAiLogs(prev => [...prev, `❌ Error during AI scan: ${err.message || err}`]);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const scanSingleExercise = async (exerciseName: string) => {
    if (!saveMachineConfig) return;

    const currentUses = dbUser?.premiumUses ?? 0;
    const hasPremiumAccess = isPremium || currentUses < 5;
    if (!hasPremiumAccess) {
      const countdown = getCreditResetCountdown(dbUser?.premiumUsesResetAt);
      setAiLogs(prev => [
        ...prev, 
        `⚡ Free Weekly AI Credits Reached (5/5). Credits reset in ${countdown.formatted}.`
      ]);
      return;
    }

    if (!isPremium) {
      try {
        await incrementPremiumUses();
      } catch (err) {
        console.error("Failed to increment usage count:", err);
      }
    }

    setSingleScanLoading(prev => ({ ...prev, [exerciseName]: true }));
    setAiLogs(prev => [...prev, `[AI] Starting search for '${exerciseName}'...`]);
    try {
      const customKey = (typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null) || dbUser?.geminiApiKey || "";
      const data = await fetchAiMuscleLookup([exerciseName], customKey);
      const results = data.results || [];

      if (results.length > 0) {
        const res = results[0];
        const originalExercise = allExercises.find(ex => 
          ex.name.trim().toLowerCase() === exerciseName.trim().toLowerCase() ||
          ex.name.trim().toLowerCase().includes(exerciseName.trim().toLowerCase())
        );
        if (originalExercise) {
          await saveMachineConfig(
            originalExercise.name,
            originalExercise.baseWeightLbs,
            originalExercise.baseWeightKg,
            originalExercise.brand,
            originalExercise.category,
            originalExercise.config?.variantCategories,
            originalExercise.type,
            undefined,
            res.muscles,
            res.groups
          );
          setAiLogs(prev => [...prev, `✓ Success: Linked '${exerciseName}' with ${res.muscles.join(', ')}`]);
        }
      } else {
        setAiLogs(prev => [...prev, `⚠ No muscles found for '${exerciseName}'`]);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === "GEMINI_API_KEY_MISSING") {
        setAiLogs(prev => [
          ...prev, 
          "❌ Error: Gemini API Key is missing. Please configure your personal key under Profile > Account Settings!"
        ]);
      } else {
        setAiLogs(prev => [...prev, `❌ Error scanning '${exerciseName}': ${err.message || err}`]);
      }
    } finally {
      setSingleScanLoading(prev => ({ ...prev, [exerciseName]: false }));
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleWipe = async () => {
    setWipeLoading(true);
    try {
      await onWipeAll();
      setShowWipeConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setWipeLoading(false);
    }
  };

  const appUrl = window.location.origin;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Settings</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-gray-200/50 dark:bg-slate-800/50 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveTab('general')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
        >
          <SettingsIcon size={14} /> General
        </button>
        <button 
          onClick={() => setActiveTab('data')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'data' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
        >
          <Database size={14} /> Data
        </button>
        <button 
          onClick={() => setActiveTab('trainingOptions')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'trainingOptions' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
        >
          <BrainCircuit size={14} /> Options
        </button>
        <button 
          onClick={() => setActiveTab('webapp')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${activeTab === 'webapp' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
        >
          <MonitorSmartphone size={14} /> Install
        </button>
      </div>
      
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
          <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Dark Mode</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Toggle dark aesthetic</p>
            </div>
            <button 
              onClick={toggleTheme}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-500' : 'bg-gray-200 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm ${theme === 'dark' ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          
          <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Haptic Feedback</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">Vibrate on logging set</p>
            </div>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-black dark:bg-white">
              <span className="inline-block h-5 w-5 transform rounded-full bg-white dark:bg-black shadow-sm transition-all translate-x-5.5" />
            </button>
          </div>

          <div className="p-5 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
             <div>
               <h3 className="font-semibold text-gray-900 dark:text-white">Default Unit</h3>
               <p className="text-sm text-gray-500 dark:text-slate-400">Your preferred tracking unit</p>
             </div>
             <div className="w-[100px]">
               <Dropdown
                 value="Lbs"
                 onChange={() => {}}
                 options={['Lbs', 'Kg']}
                 buttonClassName="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-800 text-black dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 font-medium text-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
               />
             </div>
          </div>

          {/* Membership & Subscription Management */}
          <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500 fill-amber-500" />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Stripe Membership Status
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {isPremium 
                  ? (dbUser?.hasRetentionDiscount ? '20% Off Retention Rate Active' : 'Premium Elite Billing Active')
                  : 'Free Tier (5 weekly AI credits)'}
              </p>
            </div>

            {isPremium ? (
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <ShieldAlert size={14} />
                <span>Cancel Subscription</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await setPremiumStatus(true);
                    alert("🎉 Premium Activated successfully!");
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer shrink-0"
              >
                Upgrade to Premium
              </button>
            )}
          </div>

          {/* Diagnostic & Bug Reporting */}
          <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <Bug size={14} />
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  Report a Bug or Glitch
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Encountered an unexpected calculation or UI error? Send diagnostic conditions directly to the admin error pipeline.
              </p>
            </div>

            <button
              onClick={() => setShowBugReportModal(true)}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-xl border border-rose-200/50 dark:border-rose-900/50 transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <Bug size={12} />
              Report Issue
            </button>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">Database</h3>
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/35 p-4 rounded-2xl">
              <div>
                <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 block p-0.5">Logged Sets</span>
                <span className="text-3xl font-black text-gray-900 dark:text-white">{setsCount}</span>
              </div>
              
              {!showWipeConfirm ? (
                <button
                  onClick={() => setShowWipeConfirm(true)}
                  disabled={setsCount === 0}
                  className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl transition-all disabled:opacity-40"
                >
                  Wipe All Data
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <span className="text-2xs font-extrabold text-red-500 uppercase tracking-wider block mb-1">Confirm complete deletion?</span>
                  <div className="flex gap-1.5 shadow-xs">
                    <button
                      onClick={() => setShowWipeConfirm(false)}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 text-2xs font-bold rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleWipe}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-2xs font-bold rounded-lg flex items-center gap-1"
                    >
                      {wipeLoading ? '...' : (
                        <>
                          <ShieldAlert size={12} /> Yes, Wipe
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {repairFlippedDates && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Date Correction</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  If imported sessions show inverted months (e.g., 12/06 instead of 06/12), this tool automatically swaps days and months for all ambiguous sets (where both day and month are {"<="} 12).
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    setRepairLoading(true);
                    setRepairMessage(null);
                    try {
                      const count = await repairFlippedDates();
                      if (count > 0) {
                        setRepairMessage(`Success: ${count} set(s) corrected! Days and months swapped.`);
                      } else {
                        setRepairMessage("No ambiguous sets detected (already corrected or day > 12).");
                      }
                    } catch (e) {
                      setRepairMessage("An error occurred during correction.");
                    } finally {
                      setRepairLoading(false);
                    }
                  }}
                  disabled={repairLoading || setsCount === 0}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-all"
                >
                  {repairLoading ? 'Correcting...' : 'Swap Days & Months (DD/MM ⇄ MM/DD)'}
                </button>

                {repairMessage && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-850 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/40">
                    {repairMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {applyPresetsToExistingMachines && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">Apply Muscle Presets</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  This tool scans existing machines and automatically links targeted muscles (Anatomy) if not already set.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    const initialText = btn.innerText;
                    btn.innerText = "Applying...";
                    btn.disabled = true;
                    try {
                      const count = await applyPresetsToExistingMachines();
                      alert(`Success: ${count} machine(s) updated with muscle presets.`);
                    } catch (err) {
                      alert("Error applying presets.");
                    } finally {
                      btn.innerText = initialText;
                      btn.disabled = false;
                    }
                  }}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition-all"
                >
                  Scan and Link Muscles
                </button>
              </div>
            </div>
          )}

          <CsvImporter onImport={importCSV} />
        </div>
      )}

      {activeTab === 'trainingOptions' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                  AI Muscle Identification
                  <span className="text-3xs px-2.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full font-black uppercase">
                    Gemini 3.5
                  </span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                  Connect exact primary and synergistic muscle activations with scientific literature using Gemini.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl">
              <div className="text-center p-2">
                <span className="text-2xs text-gray-400 dark:text-slate-500 font-bold block uppercase tracking-wider">Total</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">{allExercises.length}</span>
              </div>
              <div className="text-center p-2 border-x border-gray-200/60 dark:border-slate-800">
                <span className="text-2xs text-green-500 font-bold block uppercase tracking-wider">Linked</span>
                <span className="text-2xl font-black text-green-600 dark:text-green-400">
                  {allExercises.filter(ex => ex.linkedMuscles.length > 0).length}
                </span>
              </div>
              <div className="text-center p-2">
                <span className="text-2xs text-amber-500 font-bold block uppercase tracking-wider">Missing</span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {allExercises.filter(ex => ex.linkedMuscles.length === 0).length}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => runAiMuscleScan(false)}
                disabled={aiLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black py-3 px-4 rounded-xl font-bold text-xs sm:text-sm hover:scale-[1.01] active:scale-99 transition-all disabled:opacity-40"
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Scanning Missing ({aiProgress.current}/{aiProgress.total})...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-amber-400 fill-amber-400" />
                    Scan Missing Exercises
                  </>
                )}
              </button>

              <button
                onClick={() => runAiMuscleScan(true)}
                disabled={aiLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-950 dark:text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm hover:scale-[1.01] active:scale-99 transition-all disabled:opacity-40"
              >
                {aiLoading ? (
                  "Scan running..."
                ) : (
                  <>
                    <Cpu size={16} />
                    Re-Analyze All Exercises
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Console Logs */}
          {(aiLogs.length > 0 || aiLoading) && (
            <div className="bg-slate-950 text-slate-300 p-5 rounded-3xl border border-slate-900 font-mono text-2xs space-y-2 max-h-[180px] overflow-y-auto shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-1.5">
                <span className="text-slate-500 uppercase tracking-widest font-black text-3xs">AI Literature Engine Console</span>
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiLoading ? 'bg-blue-400' : 'bg-green-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${aiLoading ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                </span>
              </div>
              {aiLogs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* Exercise Mapping List */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-white">Active Exercises & Muscle Targets</h4>
            <div className="divide-y divide-gray-100 dark:divide-slate-800/80 max-h-[350px] overflow-y-auto pr-2">
              {allExercises.map((ex) => (
                <div key={ex.name} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">{ex.name}</span>
                      <span className="text-3xs px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-md uppercase font-bold">
                        {ex.type}
                      </span>
                      <span className="text-3xs px-2 py-0.5 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 rounded-md">
                        {ex.category}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 items-center">
                      {ex.linkedMuscles.length > 0 ? (
                        ex.linkedMuscles.map((m) => (
                          <span key={m} className="text-3xs px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full font-medium">
                            {m.replace(/_/g, ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-3xs font-semibold text-amber-500/80 flex items-center gap-1.5 p-0.5">
                          <AlertTriangle size={10} />
                          No muscle mappings linked
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => scanSingleExercise(ex.name)}
                    disabled={aiLoading || singleScanLoading[ex.name]}
                    className="self-start sm:self-center px-3 py-1.5 bg-gray-50 hover:bg-gray-150 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg text-2xs font-extrabold flex items-center gap-1 transition-all disabled:opacity-40 shrink-0"
                  >
                    {singleScanLoading[ex.name] ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Sparkles size={10} className="text-amber-500" />
                    )}
                    Research AI
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'webapp' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors duration-300 p-6 flex flex-col items-center text-center space-y-6">
          <div>
            <h3 className="font-bold text-xl text-gray-900 dark:text-white mb-2">Install App</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Scan this QR code from your mobile device to open the web app, then add it to your home screen.</p>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
             <QRCodeSVG value={appUrl} size={180} />
          </div>

          <a 
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold hover:scale-[1.02] transition-transform"
          >
            Open Web App URL
          </a>

          <a 
            href="/apk-download-placeholder"
            className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white py-4 rounded-xl font-bold hover:scale-[1.02] transition-transform"
          >
            Download APK
          </a>
        </div>
      )}

      <CancelSubscriptionModal 
        isOpen={isCancelModalOpen} 
        onClose={() => setIsCancelModalOpen(false)} 
      />

      <BugReportModal 
        isOpen={showBugReportModal} 
        onClose={() => setShowBugReportModal(false)} 
      />
    </div>
  )
}
