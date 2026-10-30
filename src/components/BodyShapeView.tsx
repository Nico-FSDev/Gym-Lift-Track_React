import React, { useState, useMemo, useEffect } from 'react';
import { WorkoutSet, MachineConfig } from '../types';
import { MACHINES } from './MachineList';
import { calculateFatigueScores } from '../utils/fatigue';
import { apiFetch } from '../utils/api';
import { fetchAiGainRoutine } from '../services/aiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  ChevronRight, 
  Activity, 
  Ruler, 
  Users, 
  Scale, 
  Sparkles, 
  UserCheck, 
  Flame, 
  HeartPulse,
  Dumbbell,
  Zap,
  Check,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  ArrowRight,
  Trash2,
  Target,
  ShieldCheck,
  ShieldAlert,
  Award,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import { format, isToday, subDays } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useFitbit } from '../hooks/useFitbit';

interface BodyShapeViewProps {
  sets: WorkoutSet[];
  machineConfigs?: MachineConfig[];
  onNavigateToTab?: (tabId: string, exercise?: string) => void;
  onNavigateToRegister?: (exercise: string) => void;
}

export interface GainRoutineCard {
  id: string;
  exercise: string;
  muscleGroup: string;
  type?: string;
  targetSets: number;
  targetRepsPerSet: number;
  totalTargetReps: number;
  recoveryScore: number;
  accuracyScore: number;
  biomechanicalRank: number;
  isTopBiomechanicalPick: boolean;
  synergistStatus?: string;
  rationale: string;
  createdAt: string;
}

export default function BodyShapeView({ 
  sets, 
  machineConfigs = [], 
  onNavigateToTab, 
  onNavigateToRegister 
}: BodyShapeViewProps) {
  const { dbUser, updateActiveProfileMeasurement } = useAuth();
  const { login, fetchBodyMetrics, isSyncing, error: fitbitError, isLoggedIn } = useFitbit();
  
  // Subtab State: "measures" or "gain"
  const [activeSubTab, setActiveSubTab] = useState<'measures' | 'gain'>('measures');

  // Get active profile measurements from the global auth state
  const activeProfile = dbUser?.profiles?.find(p => p.id === (dbUser.activeProfileId || 'default')) || dbUser?.profiles?.[0];

  const bodyWeight = activeProfile?.bodyWeight ?? 70;
  const height = activeProfile?.height ?? 175;
  const boneMass = activeProfile?.boneMass ?? 3;
  const bodyFat = activeProfile?.bodyFat ?? 15;
  
  // Mensurations
  const arms = activeProfile?.arms ?? 35;
  const chest = activeProfile?.chest ?? 100;
  const waist = activeProfile?.waist ?? 80;
  const thighs = activeProfile?.thighs ?? 55;
  const calves = activeProfile?.calves ?? 35;
  const neck = activeProfile?.neck ?? 38;
  const shoulders = activeProfile?.shoulders ?? 110;

  // Local state for smooth typing in input fields before blur/change sync
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const getValue = (key: string, fallback: number) => {
    if (localValues[key] !== undefined) return localValues[key];
    return fallback.toString();
  };

  const handleInputChange = (key: string, valStr: string) => {
    setLocalValues(prev => ({ ...prev, [key]: valStr }));
  };

  const handleInputBlur = (key: any, fallback: number) => {
    const raw = localValues[key];
    if (raw !== undefined) {
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= 0) {
        updateActiveProfileMeasurement(key, num);
      } else {
        setLocalValues(prev => ({ ...prev, [key]: fallback.toString() }));
      }
    }
  };

  const handleStep = (key: any, currentVal: number, step: number) => {
    const newVal = Math.max(0, Math.round((currentVal + step) * 10) / 10);
    setLocalValues(prev => ({ ...prev, [key]: newVal.toString() }));
    updateActiveProfileMeasurement(key, newVal);
  };

  const handleFitbitSync = async () => {
    if (!isLoggedIn) {
      login();
      return;
    }
    const metrics = await fetchBodyMetrics();
    if (metrics) {
      if (metrics.weight) updateActiveProfileMeasurement('bodyWeight', metrics.weight);
      if (metrics.fat) updateActiveProfileMeasurement('bodyFat', metrics.fat);
      
      // Update sync metadata directly on the profile
      // In a real app we'd update multiple fields at once, but this will trigger consecutive writes.
      updateActiveProfileMeasurement('importSource', 'fitbit');
      updateActiveProfileMeasurement('lastSyncDate', new Date().toISOString());
    }
  };

  // Modelised data calculation
  const leanBodyMass = bodyWeight - (bodyWeight * (bodyFat / 100));
  const baseMuscleMass = leanBodyMass - boneMass - (bodyWeight * 0.1);

  const chartData = useMemo(() => {
    if (sets.length === 0) return [];
    
    // Process sets per day
    const dailyVolume: Record<string, number> = {};
    sets.forEach(set => {
      let dateObj: Date | null = null;
      if (set.date) {
        if ((set.date as any).toDate) dateObj = (set.date as any).toDate();
        else if ((set.date as any).seconds) dateObj = new Date((set.date as any).seconds * 1000);
        else dateObj = new Date(set.date as any);
      }
      if (!dateObj || isNaN(dateObj.getTime())) return;

      const dateStr = format(dateObj, 'MMM dd');
      if (!dailyVolume[dateStr]) dailyVolume[dateStr] = 0;
      dailyVolume[dateStr] += set.reps * (set.weightKg || (set.weightLbs * 0.453592) || 0);
    });

    const sortedDates = Object.keys(dailyVolume).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    let cumulativeGains = 0;
    let currentFatigue = 0;

    return sortedDates.map(date => {
      const dailyVol = dailyVolume[date];
      cumulativeGains += (dailyVol / 1000) * 0.01;
      currentFatigue = (currentFatigue * 0.8) + (dailyVol / 500);

      return {
        date,
        Weight: bodyWeight,
        'Fatigue Weight': currentFatigue,
        'Muscle Weight': baseMuscleMass + cumulativeGains
      };
    });
  }, [sets, bodyWeight, baseMuscleMass]);

  if (chartData.length === 0) {
    chartData.push({
      date: format(new Date(), 'MMM dd'),
      Weight: bodyWeight,
      'Fatigue Weight': 0,
      'Muscle Weight': baseMuscleMass
    });
  }

  const latestData = chartData[chartData.length - 1];

  // ================= MUSCLE FATIGUE & RECOVERY AUDIT =================
  const muscleRecoveryAudit = useMemo(() => {
    const categories = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];
    const now = new Date();
    const threeDaysAgo = subDays(now, 3);

    // Filter sets from last 72 hours
    const recentSets = sets.filter(s => {
      let d: Date | null = null;
      if (s.date) {
        if ((s.date as any).toDate) d = (s.date as any).toDate();
        else if ((s.date as any).seconds) d = new Date((s.date as any).seconds * 1000);
        else d = new Date(s.date as any);
      }
      return d && !isNaN(d.getTime()) && d >= threeDaysAgo;
    });

    // Calculate sets count per category
    const setsCountPerCat: Record<string, number> = {};
    categories.forEach(cat => { setsCountPerCat[cat] = 0; });

    recentSets.forEach(s => {
      const cat = s.category || 'Chest';
      if (setsCountPerCat[cat] !== undefined) {
        setsCountPerCat[cat] += 1;
      } else {
        // match by category string
        const matched = categories.find(c => c.toLowerCase() === cat.toLowerCase());
        if (matched) setsCountPerCat[matched] += 1;
        else setsCountPerCat['Chest'] += 1;
      }
    });

    return categories.map(cat => {
      const loggedCount = setsCountPerCat[cat] || 0;
      let recoveryPercent = 100 - (loggedCount * 18);
      recoveryPercent = Math.max(20, Math.min(100, recoveryPercent));

      let status: 'recovered' | 'moderate' | 'depleted' = 'recovered';
      if (recoveryPercent < 55) status = 'depleted';
      else if (recoveryPercent < 80) status = 'moderate';

      return {
        category: cat,
        loggedSetsLast72h: loggedCount,
        recoveryPercent,
        status
      };
    });
  }, [sets]);

  // ================= AI GAIN ROUTINE CARDS STATE =================
  const [gainCards, setGainCards] = useState<GainRoutineCard[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`gym_lift_track_gain_cards_${dbUser?.uid || 'guest'}`);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error("Failed to load gain routine cards", e);
      }
    }
    return [];
  });

  const [isGeneratingGain, setIsGeneratingGain] = useState(false);
  const [gainError, setGainError] = useState<string | null>(null);
  const [coachGainNote, setCoachGainNote] = useState<string | null>(null);

  // Save gain cards to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`gym_lift_track_gain_cards_${dbUser?.uid || 'guest'}`, JSON.stringify(gainCards));
      } catch (e) {
        console.error("Failed to save gain cards", e);
      }
    }
  }, [gainCards, dbUser]);

  // Collect all available exercises from Lift Cards (default presets + custom configs + logged machines)
  const availableExercises = useMemo(() => {
    const defaultMachineNames = MACHINES.map(m => m.name);
    const customNamesFromSets = sets.map(s => s.exercise);
    const customNamesFromConfigs = (machineConfigs || []).map(c => c.exercise);
    
    const customNames = Array.from(new Set([...customNamesFromSets, ...customNamesFromConfigs]))
      .filter(name => !defaultMachineNames.includes(name) && name.trim() !== '');

    const userMachines = customNames.map(name => {
      const config = machineConfigs?.find(c => c.exercise.toLowerCase() === name.toLowerCase());
      return {
        name,
        category: config?.category || 'Custom',
        type: config?.type || 'Machine',
        brand: config?.brand || 'Standard',
        linkedMuscles: config?.linkedMuscles || [],
        linkedGroups: config?.linkedGroups || []
      };
    });

    const renamedDefaultNames = new Set(
      (machineConfigs || [])
        .map(c => c.originalName?.toLowerCase())
        .filter(Boolean) as string[]
    );
    const activeDefaults = MACHINES.filter(m => !renamedDefaultNames.has(m.name.toLowerCase())).map(m => {
      const config = machineConfigs?.find(c => c.exercise.toLowerCase() === m.name.toLowerCase());
      return {
        name: m.name,
        category: config?.category || m.category,
        type: config?.type || m.type,
        brand: config?.brand || 'Standard',
        linkedMuscles: config?.linkedMuscles || [],
        linkedGroups: config?.linkedGroups || []
      };
    });

    return [...activeDefaults, ...userMachines];
  }, [sets, machineConfigs]);

  // Compute individual muscle fatigue scores (agonists, synergists, and stabilizers)
  const individualMuscleFatigue = useMemo(() => {
    return calculateFatigueScores(sets, machineConfigs || []);
  }, [sets, machineConfigs]);

  // Navigate directly to the selected exercise card in the Lift tab
  const handleLogExercise = (exerciseName: string) => {
    if (onNavigateToRegister) {
      onNavigateToRegister(exerciseName);
    } else if (onNavigateToTab) {
      onNavigateToTab('bodybuilding', exerciseName);
    }
  };

  // AI Gain Routine Generator Call
  const handleGenerateGainRoutine = async () => {
    setIsGeneratingGain(true);
    setGainError(null);

    try {
      const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
      const customKey = localKey || dbUser?.geminiApiKey || undefined;

      const recentSetsPayload = sets.slice(0, 25).map(s => {
        let formattedDate: string | undefined;
        if (s.date) {
          const d = (s.date as any).toDate ? (s.date as any).toDate() : ((s.date as any).seconds ? new Date((s.date as any).seconds * 1000) : new Date(s.date as any));
          if (!isNaN(d.getTime())) formattedDate = format(d, 'yyyy-MM-dd');
        }
        return {
          exercise: s.exercise,
          reps: s.reps,
          weightKg: s.weightKg,
          weightLbs: s.weightLbs,
          category: s.category,
          date: formattedDate
        };
      });

      const data = await fetchAiGainRoutine({
        muscleStates: muscleRecoveryAudit,
        availableExercises,
        individualMuscleFatigue,
        recentSets: recentSetsPayload
      }, customKey);

      setCoachGainNote(data.coachNote || null);

      if (Array.isArray(data.routineCards)) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const formattedCards: GainRoutineCard[] = data.routineCards.map((c: any, idx: number) => ({
          id: c.id || `gain-${Date.now()}-${idx}`,
          exercise: c.exercise || 'Compound Push Press',
          muscleGroup: c.muscleGroup || 'Chest',
          type: c.type || 'Exercise',
          targetSets: Number(c.targetSets) || 4,
          targetRepsPerSet: Number(c.targetRepsPerSet) || 10,
          totalTargetReps: (Number(c.targetSets) || 4) * (Number(c.targetRepsPerSet) || 10),
          recoveryScore: Number(c.recoveryScore) || 90,
          accuracyScore: Number(c.accuracyScore) || (c.isTopBiomechanicalPick ? 96 : 85),
          biomechanicalRank: Number(c.biomechanicalRank) || (idx + 1),
          isTopBiomechanicalPick: Boolean(c.isTopBiomechanicalPick ?? (c.biomechanicalRank === 1)),
          synergistStatus: c.synergistStatus || 'Optimal Synergist Alignment',
          rationale: c.rationale || 'Targeting fully recovered muscle group for peak hypertrophy.',
          createdAt: todayStr
        }));

        setGainCards(formattedCards);
      }
    } catch (err: any) {
      console.error("AI Gain Routine generation error:", err);
      setGainError(err.message || "Failed to generate targeted routine. Please try again.");
    } finally {
      setIsGeneratingGain(false);
    }
  };

  // Compute Today's Logged Sets matching each Routine Card
  const todaySets = useMemo(() => {
    return sets.filter(s => {
      let d: Date | null = null;
      if (s.date) {
        if ((s.date as any).toDate) d = (s.date as any).toDate();
        else if ((s.date as any).seconds) d = new Date((s.date as any).seconds * 1000);
        else d = new Date(s.date as any);
      }
      return d && !isNaN(d.getTime()) && isToday(d);
    });
  }, [sets]);

  // Group routine cards by target muscle group and sort by biomechanical accuracy rank
  const groupedRoutineCards = useMemo(() => {
    const groups: Record<string, GainRoutineCard[]> = {};
    gainCards.forEach(card => {
      const g = card.muscleGroup || 'Other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(card);
    });
    // Sort each group by rank ascending (rank 1 first)
    Object.keys(groups).forEach(g => {
      groups[g].sort((a, b) => (a.biomechanicalRank || 1) - (b.biomechanicalRank || 1));
    });
    return groups;
  }, [gainCards]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpanded = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: prev[group] === undefined ? false : !prev[group]
    }));
  };

  const handleDismissCard = (id: string) => {
    setGainCards(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8 animate-in fade-in duration-300">
      {/* Active Profile Header Button */}
      <button
        type="button"
        onClick={() => onNavigateToTab?.('user')}
        className="w-full bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 p-4 sm:p-5 rounded-3xl text-white shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-between gap-4 cursor-pointer group text-left border border-white/10"
        title="Click to switch or manage profiles in Account Settings"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/15 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
            <UserCheck size={24} className="text-white" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Current Measurement Profile</div>
            <div className="text-lg sm:text-xl font-black flex items-center gap-2 text-white">
              {activeProfile?.name || 'Self'}
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl transition-colors shrink-0">
          <span className="hidden sm:inline">Select Other Profile</span>
          <span className="sm:hidden">Change</span>
          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* Sub-Tabs Navigation Header: Measures vs Gain */}
      <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-700/60 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveSubTab('measures')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'measures'
              ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-md scale-[1.01]'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Ruler size={18} className={activeSubTab === 'measures' ? 'text-purple-500' : ''} />
          <span>Measures</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('gain')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'gain'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md scale-[1.01]'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Zap size={18} className={activeSubTab === 'gain' ? 'text-emerald-500 fill-emerald-500' : ''} />
          <span>Gain</span>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase">AI Target</span>
        </button>
      </div>

      {/* ================= SUBTAB 1: MEASURES ================= */}
      {activeSubTab === 'measures' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Fitbit Sync Banner */}
          <div className="bg-teal-50 dark:bg-teal-950/30 p-4 rounded-3xl border border-teal-100 dark:border-teal-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-100 dark:bg-teal-900/50 rounded-xl text-teal-600 dark:text-teal-400">
                <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-teal-900 dark:text-teal-100">Fitbit / Smart Scale Sync</h4>
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
                  {activeProfile?.importSource === 'fitbit' && activeProfile.lastSyncDate 
                    ? `Last synced: ${format(new Date(activeProfile.lastSyncDate), 'MMM d, h:mm a')}`
                    : 'Sync your weight & body fat from Fitbit'}
                </p>
                {fitbitError && <p className="text-xs text-red-500 mt-1">{fitbitError}</p>}
              </div>
            </div>
            <button
              onClick={handleFitbitSync}
              disabled={isSyncing}
              className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? 'Syncing...' : isLoggedIn ? 'Sync Now' : 'Connect Fitbit'}
            </button>
          </div>

          {/* Overview Metric Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-sky-50 dark:bg-sky-950/30 p-4 rounded-2xl border border-sky-100 dark:border-sky-900/40">
              <div className="text-3xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Scale size={12} /> Body Weight
              </div>
              <div className="text-xl sm:text-2xl font-black text-sky-900 dark:text-sky-100">{bodyWeight.toFixed(1)} <span className="text-xs text-sky-600 dark:text-sky-400">kg</span></div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
              <div className="text-3xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Sparkles size={12} /> Muscle Mass (Est.)
              </div>
              <div className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-100">{latestData['Muscle Weight'].toFixed(2)} <span className="text-xs text-indigo-600 dark:text-indigo-400">kg</span></div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/40">
              <div className="text-3xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Flame size={12} /> Fatigue Load
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-100">{latestData['Fatigue Weight'].toFixed(1)}</div>
            </div>
          </div>

          {/* Measurement Frames Section */}
          <div className="space-y-5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Ruler size={18} className="text-purple-500" />
                Body Measurements Frame ({activeProfile?.name || 'Self'})
              </h3>
              <span className="text-xs text-gray-400 font-semibold">Auto-saved to profile</span>
            </div>

            {/* Frame Group 1: General Body Metrics */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-slate-800">
                <HeartPulse size={14} className="text-rose-500" /> Core Composition
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Weight', key: 'bodyWeight', value: bodyWeight, unit: 'kg', step: 0.5 },
                  { label: 'Height', key: 'height', value: height, unit: 'cm', step: 1 },
                  { label: 'Body Fat', key: 'bodyFat', value: bodyFat, unit: '%', step: 0.5 },
                  { label: 'Bone Mass', key: 'boneMass', value: boneMass, unit: 'kg', step: 0.1 },
                ].map((item) => (
                  <div key={item.key} className="bg-gray-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <span>{item.label}</span>
                      <span className="text-gray-400 font-mono text-3xs">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, -item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={item.step}
                        value={getValue(item.key, item.value)}
                        onChange={(e) => handleInputChange(item.key, e.target.value)}
                        onBlur={() => handleInputBlur(item.key, item.value)}
                        className="w-full text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-1 text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Frame Group 2: Upper Body */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-slate-800">
                <Activity size={14} className="text-violet-500" /> Upper Body Mensurations
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Chest', key: 'chest', value: chest, unit: 'cm', step: 0.5 },
                  { label: 'Shoulders', key: 'shoulders', value: shoulders, unit: 'cm', step: 0.5 },
                  { label: 'Arms', key: 'arms', value: arms, unit: 'cm', step: 0.5 },
                  { label: 'Neck', key: 'neck', value: neck, unit: 'cm', step: 0.5 },
                ].map((item) => (
                  <div key={item.key} className="bg-gray-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <span>{item.label}</span>
                      <span className="text-gray-400 font-mono text-3xs">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, -item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={item.step}
                        value={getValue(item.key, item.value)}
                        onChange={(e) => handleInputChange(item.key, e.target.value)}
                        onBlur={() => handleInputBlur(item.key, item.value)}
                        className="w-full text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-1 text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Frame Group 3: Lower Body & Waist */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-slate-800">
                <Ruler size={14} className="text-sky-500" /> Lower Body & Waist Mensurations
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Waist', key: 'waist', value: waist, unit: 'cm', step: 0.5 },
                  { label: 'Thighs', key: 'thighs', value: thighs, unit: 'cm', step: 0.5 },
                  { label: 'Calves', key: 'calves', value: calves, unit: 'cm', step: 0.5 },
                ].map((item) => (
                  <div key={item.key} className="bg-gray-50/80 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      <span>{item.label}</span>
                      <span className="text-gray-400 font-mono text-3xs">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, -item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step={item.step}
                        value={getValue(item.key, item.value)}
                        onChange={(e) => handleInputChange(item.key, e.target.value)}
                        onBlur={() => handleInputBlur(item.key, item.value)}
                        className="w-full text-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-1 text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleStep(item.key, item.value, item.step)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-black text-sm flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trajectory & Insights Chart */}
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xs">
            <h3 className="font-extrabold text-base text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity size={20} className="text-emerald-500" />
              Body Trajectory Chart ({activeProfile?.name || 'Self'})
            </h3>
            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    dy={10}
                  />
                  <YAxis 
                    yAxisId="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    domain={['auto', 'auto']}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Line yAxisId="left" type="monotone" dataKey="Weight" stroke="#0ea5e9" strokeWidth={3} dot={false} name="Body Weight (kg)" />
                  <Line yAxisId="left" type="monotone" dataKey="Muscle Weight" stroke="#6366f1" strokeWidth={3} dot={false} name="Muscle Weight (kg)" />
                  <Line yAxisId="right" type="monotone" dataKey="Fatigue Weight" stroke="#f59e0b" strokeWidth={3} dot={false} name="Fatigue Load" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUBTAB 2: GAIN (AI MUSCLE RECOVERY & HYPERTROPHY ENGINE) ================= */}
      {activeSubTab === 'gain' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Section 1: Muscle Recovery Audit Overview */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={22} className="text-emerald-500" />
                <div>
                  <h3 className="font-black text-base text-gray-900 dark:text-white">
                    Muscle Group Recovery Audit (72h Volume)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Overtraining protection engine analyzing your logged workout sets
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-2xs font-extrabold uppercase">
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Recovered
                </span>
                <span className="flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Moderate
                </span>
                <span className="flex items-center gap-1 text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Depleted
                </span>
              </div>
            </div>

            {/* Muscle Readiness Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {muscleRecoveryAudit.map(item => {
                const isRecovered = item.status === 'recovered';
                const isModerate = item.status === 'moderate';
                return (
                  <div
                    key={item.category}
                    className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                      isRecovered
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40'
                        : isModerate
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40'
                        : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-gray-900 dark:text-white">{item.category}</span>
                      <span className={`text-2xs font-extrabold px-2 py-0.5 rounded-full ${
                        isRecovered
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                          : isModerate
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                      }`}>
                        {item.recoveryPercent}% Ready
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          isRecovered ? 'bg-emerald-500' : isModerate ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.recoveryPercent}%` }}
                      />
                    </div>

                    <div className="text-3xs font-medium text-gray-500 dark:text-slate-400 flex justify-between">
                      <span>{item.loggedSetsLast72h} sets in 72h</span>
                      <span className="font-bold">
                        {isRecovered ? 'Ready for Gain' : isModerate ? 'Moderate Capacity' : 'Rest Required'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: AI Routine Generator Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-emerald-900/50 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/20 backdrop-blur-md rounded-2xl border border-emerald-400/30 text-emerald-300">
                  <Dumbbell size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-extrabold uppercase tracking-widest bg-emerald-500/30 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                      Hypertrophy Routine Builder
                    </span>
                    <Sparkles size={14} className="text-amber-400 fill-amber-400" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight mt-0.5">
                    Target Non-Fatigued Muscles
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateGainRoutine}
                disabled={isGeneratingGain}
                className="w-full sm:w-auto py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50 shrink-0"
              >
                {isGeneratingGain ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Analyzing Muscle Recovery...</span>
                  </>
                ) : (
                  <>
                    <Zap size={18} className="fill-white" />
                    <span>Suggest AI Targeted Exercises</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-emerald-100/80 leading-relaxed font-medium">
              AI evaluates your accumulated muscle strain, selecting exercises for unexhausted muscle groups. Each recommended exercise creates an active Routine Card with a live set countdown loop that tracks completion against your logged workout sets.
            </p>

            {gainError && (
              <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{gainError}</span>
              </div>
            )}

            {coachGainNote && (
              <div className="p-4 bg-emerald-900/40 border border-emerald-700/50 rounded-2xl space-y-1">
                <div className="text-2xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Target size={14} /> AI Hypertrophy Recovery Strategy
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed font-medium">
                  {coachGainNote}
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Active AI Routine Cards & Daily Countdown Completion Loop */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div>
                <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <Target size={20} className="text-emerald-500" />
                  Biomechanical Gain Routine Engine ({gainCards.length} Available Exercises Evaluated)
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mt-0.5">
                  All available lift cards per recovered muscle group, ranked by individual muscle fatigue and stimulus efficiency.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0 self-start sm:self-auto">
                Live Set Countdown & Deep Linking
              </span>
            </div>

            {gainCards.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-gray-100 dark:border-slate-800 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-500 shadow-inner">
                  <Dumbbell size={28} />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h4 className="font-black text-base text-gray-900 dark:text-white">No active Gain routine cards</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                    Click "Suggest AI Targeted Exercises" above. The engine analyzes all your Lift cards and individual muscle fatigue, ranking the most efficient biomechanical card first!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateGainRoutine}
                  disabled={isGeneratingGain}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Zap size={16} className="fill-white" />
                  <span>Generate Biomechanical Routine Cards</span>
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {Object.keys(groupedRoutineCards).map(groupName => {
                  const cardsInGroup = groupedRoutineCards[groupName] || [];
                  if (cardsInGroup.length === 0) return null;

                  const topPickCard = cardsInGroup.find(c => c.isTopBiomechanicalPick) || cardsInGroup[0];
                  const alternativeCards = cardsInGroup.filter(c => c.id !== topPickCard.id);
                  const isExpanded = expandedGroups[groupName] !== false;

                  // Find sets logged today matching top pick
                  const matchingTopPickToday = todaySets.filter(s => 
                    s.exercise.toLowerCase().trim() === topPickCard.exercise.toLowerCase().trim() ||
                    s.exercise.toLowerCase().includes(topPickCard.exercise.toLowerCase()) ||
                    topPickCard.exercise.toLowerCase().includes(s.exercise.toLowerCase())
                  );
                  const topPickSetsDone = matchingTopPickToday.length;
                  const topPickRepsDone = matchingTopPickToday.reduce((sum, s) => sum + s.reps, 0);
                  const topPickRemainingSets = Math.max(0, topPickCard.targetSets - topPickSetsDone);
                  const topPickRemainingReps = Math.max(0, topPickCard.totalTargetReps - topPickRepsDone);
                  const topPickFulfilled = topPickRemainingSets === 0 && topPickRemainingReps === 0;
                  const topPickProgress = Math.min(100, Math.round((topPickSetsDone / topPickCard.targetSets) * 100));

                  return (
                    <div 
                      key={`group-${groupName}`}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-md p-5 sm:p-7 space-y-6"
                    >
                      {/* Body Part Group Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                            <Layers size={22} />
                          </div>
                          <div>
                            <div className="text-2xs font-extrabold uppercase tracking-widest text-gray-400 dark:text-slate-400">
                              Target Body Part
                            </div>
                            <h4 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{groupName}</span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                {topPickCard.recoveryScore}% Recovered
                              </span>
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="text-2xs font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
                            {cardsInGroup.length} Lift {cardsInGroup.length === 1 ? 'Card' : 'Cards'} Available
                          </span>
                          {alternativeCards.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleGroupExpanded(groupName)}
                              className="text-xs font-bold text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                              title={isExpanded ? 'Collapse alternatives' : 'View all ranked exercises'}
                            >
                              <span>{isExpanded ? 'Hide alternatives' : `+${alternativeCards.length} other exercises`}</span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* #1 TOP BIOMECHANIC CARD (HIGHLIGHTED IN FIRST POSITION) */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-2xs font-black uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
                            <Sparkles size={14} className="fill-amber-400" />
                            Most Efficient Biomechanical Match (Position #1)
                          </span>
                          <span className="text-2xs font-bold text-gray-400">
                            Accuracy Rank: #1
                          </span>
                        </div>

                        <div
                          className={`p-6 rounded-3xl border-2 shadow-xl space-y-4 transition-all relative overflow-hidden ${
                            topPickFulfilled
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                              : 'bg-gradient-to-br from-emerald-50/50 via-white to-teal-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border-emerald-500/70 dark:border-emerald-500/60'
                          }`}
                        >
                          {/* Crown Highlight Banner */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 dark:border-slate-800/80 pb-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-2xs px-3 py-1 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                                  <Award size={12} className="fill-white" /> #1 Top Biomechanical Pick
                                </span>
                                <span className="bg-emerald-500 text-white font-extrabold text-2xs px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                  <Zap size={12} className="fill-white" /> {topPickCard.accuracyScore}% Biomechanical Efficiency
                                </span>
                                {topPickCard.type && (
                                  <span className="text-2xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                                    {topPickCard.type}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white pt-1">
                                {topPickCard.exercise}
                              </h3>
                            </div>

                            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                              {topPickFulfilled ? (
                                <span className="bg-emerald-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                                  <CheckCircle2 size={15} /> Goal Fulfilled Today!
                                </span>
                              ) : (
                                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1.5 border border-indigo-200/50">
                                  <Clock size={14} /> Target: {topPickCard.targetSets} sets × {topPickCard.targetRepsPerSet} reps
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDismissCard(topPickCard.id)}
                                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                title="Dismiss card"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Synergist & Biomechanical Rationale */}
                          <div className="p-4 bg-white/80 dark:bg-slate-800/80 rounded-2xl border border-emerald-100/80 dark:border-slate-800 space-y-1.5">
                            {topPickCard.synergistStatus && (
                              <div className="flex items-center gap-2">
                                <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <ShieldCheck size={13} /> Synergist Status:
                                </span>
                                <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                  {topPickCard.synergistStatus}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed font-medium">
                              💡 <strong className="text-gray-900 dark:text-white font-black">Biomechanical Advantage:</strong> {topPickCard.rationale}
                            </p>
                          </div>

                          {/* Live Set / Rep Countdown Progress */}
                          <div className="p-4 bg-gray-50/80 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs font-black">
                              <span className="text-gray-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span>Daily Countdown Progress</span>
                                {topPickFulfilled && <span className="text-emerald-600 font-bold">(100% Completed)</span>}
                              </span>
                              <span className="text-gray-900 dark:text-white font-mono">
                                {topPickSetsDone} / {topPickCard.targetSets} Sets • {topPickRepsDone} / {topPickCard.totalTargetReps} Reps
                              </span>
                            </div>

                            <div className="w-full bg-gray-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  topPickFulfilled ? 'bg-emerald-500' : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600'
                                }`}
                                style={{ width: `${topPickProgress}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-3xs font-mono text-gray-400 pt-0.5">
                              <span>
                                {topPickFulfilled
                                  ? 'All target sets & reps logged today!'
                                  : `Remaining today: ${topPickRemainingSets} sets (${topPickRemainingReps} reps)`}
                              </span>
                              <span>{topPickProgress}% Completed</span>
                            </div>
                          </div>

                          {/* Primary Action Button: Direct navigation to the exercise card in the Lift tab */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleLogExercise(topPickCard.exercise)}
                              className="w-full py-3.5 px-5 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2.5 group"
                            >
                              <Dumbbell size={18} />
                              <span>Log {topPickCard.exercise} in Lift Tab</span>
                              <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* OTHER RANKED EXERCISES FOR THIS BODY PART (#2, #3, etc.) */}
                      {alternativeCards.length > 0 && isExpanded && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between px-1">
                            <h5 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                              <span>Other Available {groupName} Lift Cards</span>
                              <span className="text-2xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                                {alternativeCards.length} alternatives ranked
                              </span>
                            </h5>
                            <span className="text-3xs text-gray-400">Sorted by accuracy score</span>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {alternativeCards.map((altCard) => {
                              // Check today sets
                              const altMatchingToday = todaySets.filter(s => 
                                s.exercise.toLowerCase().trim() === altCard.exercise.toLowerCase().trim() ||
                                s.exercise.toLowerCase().includes(altCard.exercise.toLowerCase()) ||
                                altCard.exercise.toLowerCase().includes(s.exercise.toLowerCase())
                              );
                              const altSetsDone = altMatchingToday.length;

                              return (
                                <div
                                  key={altCard.id}
                                  className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group/alt"
                                >
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 font-extrabold text-2xs px-2 py-0.5 rounded-md font-mono">
                                        Rank #{altCard.biomechanicalRank}
                                      </span>
                                      <span className="text-xs font-black text-gray-900 dark:text-white truncate">
                                        {altCard.exercise}
                                      </span>
                                      {altCard.type && (
                                        <span className="text-3xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                          {altCard.type}
                                        </span>
                                      )}
                                      <span className="text-2xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                                        {altCard.accuracyScore}% Biomechanical Match
                                      </span>
                                    </div>

                                    <p className="text-xs text-gray-600 dark:text-slate-300 leading-snug line-clamp-2">
                                      {altCard.synergistStatus && (
                                        <span className="font-bold text-gray-800 dark:text-slate-200 mr-1.5">
                                          [{altCard.synergistStatus}]
                                        </span>
                                      )}
                                      {altCard.rationale}
                                    </p>

                                    <div className="text-3xs text-gray-400 flex items-center gap-2 pt-0.5">
                                      <span>Target: {altCard.targetSets} sets × {altCard.targetRepsPerSet} reps</span>
                                      <span>•</span>
                                      <span className={altSetsDone > 0 ? 'text-emerald-600 font-bold' : ''}>
                                        {altSetsDone} sets logged today
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    <button
                                      type="button"
                                      onClick={() => handleLogExercise(altCard.exercise)}
                                      className="py-2 px-3.5 bg-white dark:bg-slate-900 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 group-hover/alt:border-emerald-500/50"
                                      title={`Open ${altCard.exercise} in Lift Tab`}
                                    >
                                      <span>Log in Lift Tab</span>
                                      <ArrowRight size={14} className="group-hover/alt:translate-x-1 transition-transform" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDismissCard(altCard.id)}
                                      className="p-2 text-gray-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                                      title="Remove card"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

