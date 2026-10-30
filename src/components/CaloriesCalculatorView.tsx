import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkoutSet } from '../types';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import { fetchAiDietitianCoach, fetchAiNutritionScan } from '../services/aiService';
import { 
  Flame, 
  Utensils, 
  Camera, 
  Upload, 
  Sparkles, 
  Plus, 
  Trash2, 
  Activity, 
  Scale, 
  ChevronRight, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Info, 
  Calendar,
  ChefHat,
  Dumbbell,
  Zap,
  Target,
  Clock,
  ThumbsUp,
  X,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface CaloriesCalculatorViewProps {
  sets: WorkoutSet[];
  onNavigateToTab?: (tabId: string) => void;
}

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  brand?: string;
  portionGrams: number;
  portionPercent: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  imagePreview?: string;
  isAiScanned?: boolean;
}

export interface SuggestedMeal {
  id: string;
  mealName: string;
  description: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  prepTimeMinutes: number;
  coachTip: string;
}

export type AthleticGoal = 
  | "Muscle Mass Gain (Hypertrophy / Volume)"
  | "Strength"
  | "Speed"
  | "Endurance";

export default function CaloriesCalculatorView({ sets, onNavigateToTab }: CaloriesCalculatorViewProps) {
  const { dbUser } = useAuth();
  
  // Active Profile
  const activeProfile = dbUser?.profiles?.find(p => p.id === (dbUser.activeProfileId || 'default')) || dbUser?.profiles?.[0];

  const bodyWeight = activeProfile?.bodyWeight ?? 70;
  const height = activeProfile?.height ?? 175;
  const bodyFat = activeProfile?.bodyFat ?? 15;

  // Subtab State: "Spent" or "Consume"
  const [activeSubTab, setActiveSubTab] = useState<'spent' | 'consume'>('spent');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // User physiology inputs for BMR
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [activityLevel, setActivityLevel] = useState<number>(1.375);

  // Athletic Goal selection for AI Dietitian
  const [athleticGoal, setAthleticGoal] = useState<AthleticGoal>("Muscle Mass Gain (Hypertrophy / Volume)");
  
  // AI Dietitian state
  const [isGeneratingMeals, setIsGeneratingMeals] = useState(false);
  const [dietitianError, setDietitianError] = useState<string | null>(null);
  const [coachSummary, setCoachSummary] = useState<string | null>(null);
  const [suggestedMeals, setSuggestedMeals] = useState<SuggestedMeal[]>([]);
  const [registeredMealSuccessId, setRegisteredMealSuccessId] = useState<string | null>(null);

  // Food log state (persisted in localStorage)
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`gym_lift_track_food_log_${dbUser?.uid || 'guest'}`);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error("Failed to load food log", e);
      }
    }
    return [];
  });

  // Save food log to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`gym_lift_track_food_log_${dbUser?.uid || 'guest'}`, JSON.stringify(foodEntries));
      } catch (e) {
        console.error("Failed to save food log", e);
      }
    }
  }, [foodEntries, dbUser]);

  // AI Scanner Modal / Form state
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<any | null>(null);
  const [selectedPortionPercent, setSelectedPortionPercent] = useState<number>(100);
  const [customPortionGrams, setCustomPortionGrams] = useState<number>(0);
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Manual food entry state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState<number | ''>('');
  const [manualProtein, setManualProtein] = useState<number | ''>('');
  const [manualCarbs, setManualCarbs] = useState<number | ''>('');
  const [manualFat, setManualFat] = useState<number | ''>('');
  const [manualGrams, setManualGrams] = useState<number | ''>(100);
  const [manualMealType, setManualMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ================= CALORIES BURNT CALCULATIONS (SPENT) =================
  const leanBodyMassKg = useMemo(() => {
    return Math.max(30, bodyWeight * (1 - (bodyFat / 100)));
  }, [bodyWeight, bodyFat]);

  const bmr = useMemo(() => {
    return Math.round(370 + (21.6 * leanBodyMassKg));
  }, [leanBodyMassKg]);

  const tdeeBase = useMemo(() => {
    return Math.round(bmr * activityLevel);
  }, [bmr, activityLevel]);

  // Daily Sets Filtering
  const daySets = useMemo(() => {
    return sets.filter(s => {
      if (!s.date) return false;
      const d = (s.date as any).toDate ? (s.date as any).toDate() : ((s.date as any).seconds ? new Date((s.date as any).seconds * 1000) : new Date(s.date as any));
      if (isNaN(d.getTime())) return false;
      return format(d, 'yyyy-MM-dd') === selectedDate;
    });
  }, [sets, selectedDate]);

  // Workout Calories Burnt Calculation
  const workoutVolumeKg = useMemo(() => {
    return daySets.reduce((sum, set) => {
      const w = set.weightKg || (set.weightLbs * 0.453592) || 0;
      return sum + (set.reps * w);
    }, 0);
  }, [daySets]);

  const workoutDurationMinutes = useMemo(() => {
    if (daySets.length === 0) return 0;
    return Math.max(15, daySets.length * 2);
  }, [daySets]);

  const workoutCaloriesBurnt = useMemo(() => {
    if (daySets.length === 0) return 0;
    const metCalories = (6.0 * bodyWeight * (workoutDurationMinutes / 60));
    const volumeBonus = (workoutVolumeKg / 1000) * 12;
    return Math.round(metCalories + volumeBonus);
  }, [daySets, bodyWeight, workoutDurationMinutes, workoutVolumeKg]);

  const fatigueCaloriesBurnt = useMemo(() => {
    if (workoutCaloriesBurnt === 0) return 0;
    return Math.round(workoutCaloriesBurnt * 0.12);
  }, [workoutCaloriesBurnt]);

  const totalCaloriesBurntToday = useMemo(() => {
    return tdeeBase + workoutCaloriesBurnt + fatigueCaloriesBurnt;
  }, [tdeeBase, workoutCaloriesBurnt, fatigueCaloriesBurnt]);

  // ================= FOOD INTAKE CALCULATIONS (CONSUME) =================
  const dayFoodEntries = useMemo(() => {
    return foodEntries.filter(entry => entry.date === selectedDate);
  }, [foodEntries, selectedDate]);

  const totalsConsumed = useMemo(() => {
    return dayFoodEntries.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dayFoodEntries]);

  const remainingEnergyBudget = useMemo(() => {
    return Math.max(150, totalCaloriesBurntToday - totalsConsumed.calories);
  }, [totalCaloriesBurntToday, totalsConsumed.calories]);

  // ================= AI DIETITIAN COACH MEAL GENERATOR =================
  const handleGenerateDietitianMeals = async () => {
    setIsGeneratingMeals(true);
    setDietitianError(null);
    setCoachSummary(null);

    try {
      const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
      const customKey = localKey || dbUser?.geminiApiKey || undefined;

      const data = await fetchAiDietitianCoach({
        goal: athleticGoal,
        todaySets: daySets.map(s => ({
          exercise: s.exercise,
          reps: s.reps,
          weightKg: s.weightKg,
          category: s.category,
        })),
        recentSets: sets.slice(0, 15).map(s => ({
          exercise: s.exercise,
          reps: s.reps,
          weightKg: s.weightKg,
          category: s.category,
        })),
        todayCaloriesBurnt: totalCaloriesBurntToday,
        currentIntakeCalories: totalsConsumed.calories,
        maxAllowedCalories: remainingEnergyBudget,
      }, customKey);

      setCoachSummary(data.coachSummary || null);
      setSuggestedMeals(data.meals || []);
    } catch (err: any) {
      console.error("AI Dietitian generation error:", err);
      setDietitianError(err.message || "Failed to generate meal suggestions. Please try again.");
    } finally {
      setIsGeneratingMeals(false);
    }
  };

  const handleRegisterMeal = (meal: SuggestedMeal) => {
    const newEntry: FoodEntry = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      date: selectedDate,
      mealType: 'lunch',
      name: meal.mealName,
      portionGrams: 250,
      portionPercent: 100,
      calories: Math.round(meal.calories),
      protein: Math.round(meal.proteinGrams),
      carbs: Math.round(meal.carbsGrams),
      fat: Math.round(meal.fatGrams),
      fiber: Math.round(meal.fiberGrams),
      isAiScanned: true,
    };

    setFoodEntries(prev => [newEntry, ...prev]);
    setRegisteredMealSuccessId(meal.id);
    setTimeout(() => {
      setRegisteredMealSuccessId(null);
    }, 3000);
  };

  const handleDismissMeal = (mealId: string) => {
    setSuggestedMeals(prev => prev.filter(m => m.id !== mealId));
  };

  // ================= AI IMAGE & NUTRITION LABEL SCANNER =================
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setScanError("Image file is too large (max 8MB). Please choose a smaller photo.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      processImageWithAI(base64String, file.type);
    };
    reader.readAsDataURL(file);
  };

  const processImageWithAI = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setScanError(null);
    setScannedResult(null);

    try {
      const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;

      const data = await fetchAiNutritionScan({
        imageBase64: base64Image,
        mimeType,
        prompt: "Identify this food dish or read this nutrition facts etiquette label. Provide calories, protein, carbs, fat, fiber per 100g and estimated portion grams.",
      }, localKey || undefined);

      setScannedResult(data);
      setSelectedPortionPercent(100);
      setCustomPortionGrams(data.estimatedPortionGrams || 100);
    } catch (err: any) {
      console.error("AI Nutrition scan error:", err);
      setScanError(err.message || "Failed to scan image. Please verify your connection or try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddScannedFood = () => {
    if (!scannedResult) return;

    const finalCalories = Math.round((scannedResult.caloriesPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100));
    const finalProtein = Math.round((scannedResult.proteinPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100) * 10) / 10;
    const finalCarbs = Math.round((scannedResult.carbsPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100) * 10) / 10;
    const finalFat = Math.round((scannedResult.fatPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100) * 10) / 10;

    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      mealType: selectedMealType,
      name: scannedResult.foodName || 'Scanned Food Item',
      brand: scannedResult.brand || '',
      portionGrams: Math.round(customPortionGrams * (selectedPortionPercent / 100)),
      portionPercent: selectedPortionPercent,
      calories: finalCalories,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      imagePreview: imagePreview || undefined,
      isAiScanned: true,
    };

    setFoodEntries(prev => [newEntry, ...prev]);

    // Reset scanner modal
    setScannedResult(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddManualFood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || manualCalories === '') return;

    const newEntry: FoodEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      mealType: manualMealType,
      name: manualName,
      portionGrams: Number(manualGrams) || 100,
      portionPercent: 100,
      calories: Number(manualCalories),
      protein: Number(manualProtein) || 0,
      carbs: Number(manualCarbs) || 0,
      fat: Number(manualFat) || 0,
      isAiScanned: false,
    };

    setFoodEntries(prev => [newEntry, ...prev]);

    setManualName('');
    setManualCalories('');
    setManualProtein('');
    setManualCarbs('');
    setManualFat('');
    setManualGrams(100);
    setShowManualForm(false);
  };

  const handleDeleteFoodEntry = (id: string) => {
    setFoodEntries(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* Top Banner Button to Active Measurement Profile */}
      <button
        type="button"
        onClick={() => onNavigateToTab?.('user')}
        className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 p-4 sm:p-5 rounded-3xl text-white shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-between gap-4 cursor-pointer group text-left border border-white/10"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/15 rounded-2xl group-hover:scale-110 transition-transform shrink-0">
            <Flame size={24} className="text-amber-200 fill-amber-200" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-200">Physiology Source</div>
            <div className="text-lg sm:text-xl font-black flex items-center gap-2 text-white">
              {activeProfile?.name || 'Self'} ({bodyWeight} kg, {bodyFat}% Fat)
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl transition-colors shrink-0">
          <span className="hidden sm:inline">Edit Body Profile</span>
          <span className="sm:hidden">Edit</span>
          <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* Primary Sub-Tabs Navigation Header */}
      <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-gray-200 dark:border-slate-700/60 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveSubTab('spent')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'spent'
              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-md scale-[1.01]'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Flame size={18} className={activeSubTab === 'spent' ? 'text-amber-500 fill-amber-500' : ''} />
          <span>Spent</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('consume')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'consume'
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-md scale-[1.01]'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Utensils size={18} className={activeSubTab === 'consume' ? 'text-emerald-500' : ''} />
          <span>Consume</span>
        </button>
      </div>

      {/* Target Date Filter Bar */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider">
          <Calendar size={16} className="text-orange-500" />
          <span>Target Date:</span>
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
        />
      </div>

      {/* ================= SUBTAB 1: SPENT ================= */}
      {activeSubTab === 'spent' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Expenditure Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-amber-500 text-white p-4 sm:p-5 rounded-3xl shadow-lg shadow-amber-500/20 col-span-2 sm:col-span-1">
              <div className="text-3xs font-black text-amber-100 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Flame size={14} className="fill-white" /> Total Burnt Today
              </div>
              <div className="text-2xl sm:text-3xl font-black">{totalCaloriesBurntToday.toLocaleString()} <span className="text-xs text-amber-200">kcal</span></div>
              <div className="text-3xs text-amber-100 mt-1 font-semibold">BMR + Workouts + EPOC</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs">
              <div className="text-3xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Activity size={14} className="text-sky-500" /> Basal Metabolic (BMR)
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{bmr.toLocaleString()} <span className="text-xs text-sky-500">kcal</span></div>
              <div className="text-3xs text-gray-400 mt-1 font-mono">Katch-McArdle LBM</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs">
              <div className="text-3xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Sparkles size={14} className="text-purple-500" /> Workout Lifts
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{workoutCaloriesBurnt.toLocaleString()} <span className="text-xs text-purple-500">kcal</span></div>
              <div className="text-3xs text-gray-400 mt-1 font-mono">{daySets.length} sets • {workoutVolumeKg.toLocaleString()} kg</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs">
              <div className="text-3xs font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <RefreshCw size={14} className="text-rose-500" /> Fatigue EPOC Burn
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{fatigueCaloriesBurnt.toLocaleString()} <span className="text-xs text-rose-500">kcal</span></div>
              <div className="text-3xs text-gray-400 mt-1 font-mono">Post-workout oxygen</div>
            </div>
          </div>

          {/* Physiology & BMR Parameters Card */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Scale size={20} className="text-amber-500" />
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Basal Metabolic Rate (BMR) Configuration</h3>
              </div>
              <span className="text-xs font-mono text-gray-400">Katch-McArdle Formula</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Age (Years)</label>
                <input
                  type="number"
                  value={age}
                  onChange={e => setAge(Math.max(10, Number(e.target.value)))}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Gender</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value as 'male' | 'female')}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-2xs font-extrabold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Daily Non-Gym Activity</label>
                <select
                  value={activityLevel}
                  onChange={e => setActivityLevel(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-sm font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
                >
                  <option value={1.2}>Sedentary (Office / Desk Job)</option>
                  <option value={1.375}>Lightly Active (1-3 days light movement)</option>
                  <option value={1.55}>Moderately Active (Active work / Daily steps)</option>
                  <option value={1.725}>Very Active (Heavy manual work / High movement)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info size={14} className="text-amber-600" /> Precision Lean Body Mass Calculation
              </div>
              <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                Your BMR is computed directly from your active profile's Lean Body Mass (<span className="font-black">{leanBodyMassKg.toFixed(1)} kg</span>) using <span className="font-black">{bodyWeight} kg</span> body weight and <span className="font-black">{bodyFat}%</span> body fat. TDEE Base is <span className="font-black">{tdeeBase.toLocaleString()} kcal</span>.
              </p>
            </div>
          </div>

          {/* Workout Expenditure Breakdown for Selected Date */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-purple-500" />
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Recorded Sets Expenditure Breakdown</h3>
              </div>
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-full">
                {daySets.length} sets logged for {selectedDate}
              </span>
            </div>

            {daySets.length === 0 ? (
              <div className="py-8 text-center text-gray-400 dark:text-slate-500 space-y-2">
                <Activity size={32} className="mx-auto opacity-40" />
                <p className="text-sm font-semibold">No workout sets recorded for this date.</p>
                <p className="text-xs">Log workouts in the "Lift" tab to automatically calculate exercise energy expenditure!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl text-xs font-bold">
                  <div>
                    <span className="text-gray-400 block text-3xs uppercase">Lifted Volume</span>
                    <span className="text-gray-900 dark:text-white text-base font-black">{workoutVolumeKg.toLocaleString()} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-3xs uppercase">Est. Session Duration</span>
                    <span className="text-gray-900 dark:text-white text-base font-black">{workoutDurationMinutes} min</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-400 block text-3xs uppercase">Estimated MET Intensity</span>
                    <span className="text-gray-900 dark:text-white text-base font-black">6.0 METs (Heavy Resistance)</span>
                  </div>
                </div>

                <div className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-3 bg-gray-50/80 dark:bg-slate-800/80 text-3xs font-black text-gray-400 uppercase tracking-wider grid grid-cols-12 gap-2">
                    <div className="col-span-6">Exercise Name</div>
                    <div className="col-span-3 text-center">Reps x Weight</div>
                    <div className="col-span-3 text-right">Volume</div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                    {daySets.map((set, idx) => (
                      <div key={set.id || idx} className="p-3 text-xs font-semibold grid grid-cols-12 gap-2 items-center hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                        <div className="col-span-6 font-bold text-gray-900 dark:text-white truncate">{set.exercise}</div>
                        <div className="col-span-3 text-center text-gray-600 dark:text-slate-300 font-mono">
                          {set.reps} × {set.weightKg ? `${set.weightKg}kg` : `${set.weightLbs}lbs`}
                        </div>
                        <div className="col-span-3 text-right font-black text-purple-600 dark:text-purple-400">
                          {Math.round(set.reps * (set.weightKg || (set.weightLbs * 0.453592) || 0)).toLocaleString()} kg
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 2: CONSUME ================= */}
      {activeSubTab === 'consume' && (
        <div className="space-y-6 animate-in fade-in duration-200">

          {/* AI DIETITIAN COACH CARD */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-indigo-900/60 space-y-6">
            
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-800/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/20 backdrop-blur-md rounded-2xl border border-indigo-400/30 text-indigo-300">
                  <ChefHat size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-extrabold uppercase tracking-widest bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                      Personal Dietitian Coach
                    </span>
                    <Sparkles size={14} className="text-amber-400 fill-amber-400" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight mt-0.5">
                    Tailored Athletic Nutrition Suggestions
                  </h3>
                </div>
              </div>

              {/* Energy Constraint Badge */}
              <div className="bg-indigo-900/60 border border-indigo-700/50 px-3.5 py-2 rounded-2xl text-right shrink-0">
                <span className="text-3xs font-extrabold text-indigo-300 uppercase block">Max Energy Cap Per Meal</span>
                <span className="text-base font-black text-amber-300">≤ {remainingEnergyBudget} kcal</span>
              </div>
            </div>

            {/* Athletic Goal Selector Pills */}
            <div className="space-y-2">
              <label className="text-2xs font-extrabold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <Target size={14} className="text-amber-400" />
                Select Target Athletic Outcome:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  {
                    id: "Muscle Mass Gain (Hypertrophy / Volume)",
                    label: "Muscle Mass Gain",
                    sub: "Hypertrophy / Volume",
                    icon: Dumbbell,
                    color: "from-amber-500 to-orange-600"
                  },
                  {
                    id: "Strength",
                    label: "Strength",
                    sub: "Heavy Power & CNS",
                    icon: Flame,
                    color: "from-rose-500 to-red-600"
                  },
                  {
                    id: "Speed",
                    label: "Speed",
                    sub: "Fast-Twitch Neural",
                    icon: Zap,
                    color: "from-yellow-500 to-amber-600"
                  },
                  {
                    id: "Endurance",
                    label: "Endurance",
                    sub: "Glycogen & Aerobic",
                    icon: Activity,
                    color: "from-emerald-500 to-teal-600"
                  }
                ].map((g) => {
                  const IconComp = g.icon;
                  const isSelected = athleticGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setAthleticGoal(g.id as AthleticGoal)}
                      className={`p-3 rounded-2xl text-left transition-all cursor-pointer border flex items-center gap-2.5 ${
                        isSelected
                          ? `bg-gradient-to-r ${g.color} text-white border-white/30 shadow-lg scale-[1.02]`
                          : 'bg-indigo-950/40 text-indigo-200 border-indigo-800/40 hover:bg-indigo-900/40'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/20' : 'bg-indigo-900/50'}`}>
                        <IconComp size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-black leading-tight">{g.label}</div>
                        <div className="text-[10px] opacity-80 font-medium">{g.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Meal Suggestions Button */}
            <button
              type="button"
              onClick={handleGenerateDietitianMeals}
              disabled={isGeneratingMeals}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {isGeneratingMeals ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>AI Dietitian Coach analyzing today's workouts & generating targeted meals...</span>
                </>
              ) : (
                <>
                  <ChefHat size={18} />
                  <span>Generate Goal-Specific Personalized Meals</span>
                </>
              )}
            </button>

            {/* Dietitian Error Notice */}
            {dietitianError && (
              <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-xs text-rose-200 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{dietitianError}</span>
              </div>
            )}

            {/* Coach Analysis Summary */}
            {coachSummary && (
              <div className="p-4 bg-indigo-900/40 border border-indigo-700/50 rounded-2xl space-y-1">
                <div className="text-2xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <ThumbsUp size={14} /> Coach Insights for Today's Training
                </div>
                <p className="text-xs text-indigo-100/90 leading-relaxed font-medium">
                  {coachSummary}
                </p>
              </div>
            )}

            {/* Suggested Meal Cards List */}
            {suggestedMeals.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="text-xs font-extrabold text-indigo-200 uppercase tracking-wider flex items-center justify-between">
                  <span>Recommended Meals (Under {remainingEnergyBudget} kcal Limit)</span>
                  <span className="text-[10px] text-amber-300 font-mono">{suggestedMeals.length} Options</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {suggestedMeals.map((meal) => {
                    const isRegistered = registeredMealSuccessId === meal.id;
                    return (
                      <div
                        key={meal.id}
                        className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-lg space-y-4 relative overflow-hidden transition-all hover:border-indigo-500/40"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-full">
                              {athleticGoal.split(' ')[0]} Goal
                            </span>
                            <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                              <Clock size={12} /> {meal.prepTimeMinutes} min prep
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                              {meal.calories} kcal
                            </span>
                            <span className="text-2xs text-gray-400 block font-semibold">Fits Energy Budget</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-base font-black text-gray-900 dark:text-white">
                            {meal.mealName}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {meal.description}
                          </p>
                        </div>

                        {/* Macros Grid */}
                        <div className="grid grid-cols-4 gap-2 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl text-center text-xs font-bold">
                          <div>
                            <span className="text-3xs text-gray-400 uppercase block">Protein</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black">{meal.proteinGrams}g</span>
                          </div>
                          <div>
                            <span className="text-3xs text-gray-400 uppercase block">Carbs</span>
                            <span className="text-amber-600 dark:text-amber-400 font-black">{meal.carbsGrams}g</span>
                          </div>
                          <div>
                            <span className="text-3xs text-gray-400 uppercase block">Fats</span>
                            <span className="text-rose-600 dark:text-rose-400 font-black">{meal.fatGrams}g</span>
                          </div>
                          <div>
                            <span className="text-3xs text-gray-400 uppercase block">Fiber</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-black">{meal.fiberGrams}g</span>
                          </div>
                        </div>

                        {/* Coach Tip */}
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl text-xs text-amber-900 dark:text-amber-200 font-medium">
                          <span className="font-extrabold text-amber-700 dark:text-amber-300">💡 Coach Rationale: </span>
                          {meal.coachTip}
                        </div>

                        {/* Actions: Register Eaten Meal vs Dismiss */}
                        <div className="flex gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRegisterMeal(meal)}
                            className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                              isRegistered
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95'
                            }`}
                          >
                            {isRegistered ? (
                              <>
                                <CheckCircle2 size={16} />
                                <span>Registered Eaten Meal!</span>
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                <span>Register Meal (Eaten)</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDismissMeal(meal.id)}
                            className="px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <X size={16} />
                            <span>Dismiss</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Daily Intake vs Burnt Balance Card */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <ChefHat size={20} className="text-emerald-500" />
                Daily Energy & Macro Intake Balance
              </h3>
              <span className="text-xs font-mono text-gray-400">{selectedDate}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                <div className="text-3xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Calories Consumed</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-100">{totalsConsumed.calories.toLocaleString()} <span className="text-xs font-mono text-emerald-600">kcal</span></div>
              </div>

              <div className="p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40">
                <div className="text-3xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Protein Intake</div>
                <div className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100">{totalsConsumed.protein.toFixed(1)} <span className="text-xs font-mono text-blue-600">g</span></div>
              </div>

              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                <div className="text-3xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Carbohydrates</div>
                <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-100">{totalsConsumed.carbs.toFixed(1)} <span className="text-xs font-mono text-amber-600">g</span></div>
              </div>

              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100 dark:border-rose-900/40">
                <div className="text-3xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">Fats Intake</div>
                <div className="text-xl sm:text-2xl font-black text-rose-900 dark:text-rose-100">{totalsConsumed.fat.toFixed(1)} <span className="text-xs font-mono text-rose-600">g</span></div>
              </div>
            </div>

            {/* Net Energy Balance Progress Bar */}
            <div className="p-4 bg-gray-50/80 dark:bg-slate-800/40 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-gray-500 dark:text-slate-400 uppercase tracking-wider">Net Energy Balance (Consumed vs Burnt)</span>
                <span className={`font-black px-2.5 py-0.5 rounded-full text-xs ${
                  totalsConsumed.calories > totalCaloriesBurntToday
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {totalsConsumed.calories > totalCaloriesBurntToday
                    ? `+${totalsConsumed.calories - totalCaloriesBurntToday} kcal (Surplus)`
                    : `${totalsConsumed.calories - totalCaloriesBurntToday} kcal (Deficit)`}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (totalsConsumed.calories / Math.max(1, totalCaloriesBurntToday)) * 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-3xs font-mono text-gray-400">
                <span>Consumed: {totalsConsumed.calories} kcal</span>
                <span>Target Expenditure: {totalCaloriesBurntToday.toLocaleString()} kcal</span>
              </div>
            </div>
          </div>

          {/* Action Row: AI Photo Scanner & Manual Food Entry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* AI Photo Scanner Trigger Card */}
            <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white p-5 rounded-3xl shadow-lg space-y-3 relative overflow-hidden">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                  <Camera size={22} className="text-purple-200" />
                </div>
                <div>
                  <h4 className="font-black text-base flex items-center gap-1.5">
                    AI Photo & Label Scanner <Sparkles size={16} className="text-amber-300 fill-amber-300" />
                  </h4>
                  <p className="text-2xs text-indigo-100">Scan food plate or nutrition label</p>
                </div>
              </div>

              <p className="text-xs text-indigo-100/90 leading-relaxed">
                Take a picture of any meal or packaging label. Gemini AI will calculate calories and macros automatically!
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
                id="ai-food-camera-upload-consume"
              />

              <label
                htmlFor="ai-food-camera-upload-consume"
                className="w-full bg-white text-indigo-950 font-black py-3 px-4 rounded-2xl hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md text-sm"
              >
                <Camera size={18} className="text-indigo-600" />
                <span>Snap / Upload Food Photo</span>
              </label>
            </div>

            {/* Manual Food Entry Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                    <Plus size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-base text-gray-900 dark:text-white">Manual Food Entry</h4>
                    <p className="text-2xs text-gray-400">Add food items, calories & macros manually</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Quickly log custom foods, shakes, or snacks into today's nutritional table.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowManualForm(!showManualForm)}
                className="w-full bg-gray-900 dark:bg-white text-white dark:text-slate-900 font-black py-3 px-4 rounded-2xl hover:bg-black dark:hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md text-sm"
              >
                <Plus size={18} />
                <span>{showManualForm ? 'Close Form' : 'Add Manual Entry'}</span>
              </button>
            </div>
          </div>

          {/* AI SCANNER RESULTS & PORTION ADJUSTMENT MODAL / CARD */}
          {(isScanning || scannedResult || scanError) && (
            <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/40 p-5 sm:p-6 rounded-3xl shadow-xl space-y-5 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles size={20} className="text-indigo-500" />
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">AI Nutrition Recognition</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setScannedResult(null); setScanError(null); setImagePreview(null); }}
                  className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>

              {isScanning && (
                <div className="py-10 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-bold text-gray-700 dark:text-slate-200">Analyzing image & reading nutrition values...</p>
                  <p className="text-xs text-gray-400">Extracting calories, protein, carbs, and fat per 100g</p>
                </div>
              )}

              {scanError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Scan Error</div>
                    <p className="mt-0.5">{scanError}</p>
                  </div>
                </div>
              )}

              {scannedResult && !isScanning && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {imagePreview && (
                      <div className="w-full sm:w-36 h-36 rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0 border border-gray-200 dark:border-slate-700">
                        <img src={imagePreview} alt="Scanned Food" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-black text-gray-900 dark:text-white">{scannedResult.foodName}</h4>
                          {scannedResult.brand && <span className="text-xs text-gray-400 font-bold">{scannedResult.brand}</span>}
                        </div>
                        <span className={`text-3xs font-extrabold uppercase px-2.5 py-1 rounded-full ${
                          scannedResult.confidence === 'high' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {scannedResult.confidence || 'Medium'} Confidence
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{scannedResult.notes}</p>

                      <div className="p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl text-xs font-mono font-bold text-gray-700 dark:text-slate-300">
                        Base values per 100g: <span className="text-indigo-600 dark:text-indigo-400">{scannedResult.caloriesPer100g} kcal</span> | P: {scannedResult.proteinPer100g}g | C: {scannedResult.carbsPer100g}g | F: {scannedResult.fatPer100g}g
                      </div>
                    </div>
                  </div>

                  {/* Portion Percentage & Grams Selector Frame */}
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-gray-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase text-gray-700 dark:text-slate-200 tracking-wider">
                        Eaten Portion Adjuster
                      </label>
                      <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {selectedPortionPercent}% Portion ({Math.round(customPortionGrams * (selectedPortionPercent / 100))}g)
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[25, 50, 75, 100, 125, 150, 200].slice(0, 4).map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSelectedPortionPercent(pct)}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            selectedPortionPercent === pct
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-3xs font-extrabold text-gray-400 uppercase">Custom Portion %</label>
                        <input
                          type="number"
                          value={selectedPortionPercent}
                          onChange={e => setSelectedPortionPercent(Math.max(10, Number(e.target.value)))}
                          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-black text-gray-900 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="text-3xs font-extrabold text-gray-400 uppercase">Estimated Portion Grams</label>
                        <input
                          type="number"
                          value={customPortionGrams}
                          onChange={e => setCustomPortionGrams(Math.max(10, Number(e.target.value)))}
                          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-black text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                      <span className="text-xs font-extrabold text-indigo-900 dark:text-indigo-200">Portion Total:</span>
                      <div className="text-sm font-black text-indigo-950 dark:text-indigo-100 flex items-center gap-3">
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                          {Math.round((scannedResult.caloriesPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100))} kcal
                        </span>
                        <span className="text-xs font-normal">
                          (P: {Math.round((scannedResult.proteinPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100))}g | C: {Math.round((scannedResult.carbsPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100))}g | F: {Math.round((scannedResult.fatPer100g * customPortionGrams / 100) * (selectedPortionPercent / 100))}g)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-gray-500">Meal Category:</label>
                      <select
                        value={selectedMealType}
                        onChange={e => setSelectedMealType(e.target.value as any)}
                        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-black text-gray-900 dark:text-white cursor-pointer"
                      >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="dinner">Dinner</option>
                        <option value="snack">Snack</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddScannedFood}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    <Check size={18} />
                    <span>Confirm & Add to Today's Food Log</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MANUAL ENTRY FORM */}
          {showManualForm && (
            <form onSubmit={handleAddManualFood} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-5 rounded-3xl shadow-md space-y-4 animate-in slide-in-from-top-2 duration-200">
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white">Manual Meal Entry</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-3xs font-extrabold uppercase text-gray-400">Food / Dish Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grilled Salmon & Quinoa"
                    value={manualName}
                    onChange={e => setManualName(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-gray-400">Meal Category</label>
                  <select
                    value={manualMealType}
                    onChange={e => setManualMealType(e.target.value as any)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold text-gray-900 dark:text-white cursor-pointer"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-3xs font-extrabold uppercase text-gray-400">Portion (g)</label>
                  <input
                    type="number"
                    value={manualGrams}
                    onChange={e => setManualGrams(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-black text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-emerald-600">Calories (kcal)</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 450"
                    value={manualCalories}
                    onChange={e => setManualCalories(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-blue-500">Protein (g)</label>
                  <input
                    type="number"
                    placeholder="e.g. 35"
                    value={manualProtein}
                    onChange={e => setManualProtein(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-black text-blue-600 dark:text-blue-400"
                  />
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-amber-500">Carbs (g)</label>
                  <input
                    type="number"
                    placeholder="e.g. 40"
                    value={manualCarbs}
                    onChange={e => setManualCarbs(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-black text-amber-600 dark:text-amber-400"
                  />
                </div>

                <div>
                  <label className="text-3xs font-extrabold uppercase text-rose-500">Fat (g)</label>
                  <input
                    type="number"
                    placeholder="e.g. 12"
                    value={manualFat}
                    onChange={e => setManualFat(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-black text-rose-600 dark:text-rose-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer"
              >
                Save Food Entry
              </button>
            </form>
          )}

          {/* Daily Food Log Table */}
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white flex items-center gap-2">
                <Utensils size={18} className="text-emerald-500" />
                Registered Food Entries for {selectedDate}
              </h3>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
                {dayFoodEntries.length} Items Logged
              </span>
            </div>

            {dayFoodEntries.length === 0 ? (
              <div className="py-8 text-center text-gray-400 dark:text-slate-500 space-y-2">
                <ChefHat size={32} className="mx-auto opacity-40" />
                <p className="text-sm font-semibold">No food logged for this date.</p>
                <p className="text-xs">Use the AI Dietitian Coach above or snap a food photo to register your meals!</p>
              </div>
            ) : (
              <div className="border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
                {dayFoodEntries.map(entry => (
                  <div key={entry.id} className="p-3.5 text-xs font-semibold flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      {entry.imagePreview ? (
                        <img src={entry.imagePreview} alt={entry.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-gray-200 dark:border-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <ChefHat size={18} />
                        </div>
                      )}

                      <div>
                        <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          {entry.name}
                          {entry.isAiScanned && (
                            <span className="text-3xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-extrabold px-1.5 py-0.5 rounded-full">
                              AI
                            </span>
                          )}
                        </div>
                        <div className="text-3xs text-gray-400 font-mono">
                          {entry.mealType.toUpperCase()} • {entry.portionGrams}g portion
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {entry.calories} kcal
                        </div>
                        <div className="text-3xs text-gray-400 font-mono">
                          P:{entry.protein}g | C:{entry.carbs}g | F:{entry.fat}g
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteFoodEntry(entry.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
