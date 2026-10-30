import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { MachineConfig, WorkoutSet } from '../types';
import { MACHINES } from './MachineList';
import { History, ArrowLeft, Edit2, Trash2, Check, Calendar, ChevronDown, ChevronUp, Clock, Sparkles, ShieldAlert, Dumbbell, TrendingUp, Zap, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import Dropdown from './Dropdown';
import RepsInput from './RepsInput';
import DegreeWheelPicker from './DegreeWheelPicker';
import { useTheme } from './ThemeProvider';
import { calculateFatigueScores } from '../utils/fatigue';
import { useAuth, getCreditResetCountdown } from '../hooks/useAuth';
import { apiFetch } from '../utils/api';
import { fetchAiAnalyzeMode } from '../services/aiService';
import { audioManager } from '../utils/audioManager';
import { backButtonManager } from '../utils/backButtonManager';

interface AddWorkoutFormProps {
  addSet: (data: any) => Promise<void>;
  updateSet?: (id: string, data: any) => Promise<void>;
  deleteSet?: (id: string) => Promise<void>;
  onSuccess: () => void;
  initialExercise?: string;
  initialVariant?: string;
  initialPosture?: string;
  initialWeightModifier?: number;
  initialWeight?: number;
  initialReps?: number;
  initialDegrees?: number;
  machineConfigs?: MachineConfig[];
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
  sets?: WorkoutSet[];
  onExerciseRename?: (newExercise: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

const roundToTwo = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

const getPlateWeight = (
  totalWeightLbs: number,
  exerciseName: string,
  configs: MachineConfig[],
  modifierPercent: number | undefined | null,
  targetUnit: 'lbs' | 'kg'
): string => {
  if (!exerciseName) return '';
  const config = configs.find(c => c.exercise.toLowerCase() === exerciseName.toLowerCase());
  const baseLbs = config ? config.baseWeightLbs : 0;
  
  const modifier = modifierPercent !== undefined && modifierPercent !== null ? modifierPercent / 100 : 1;
  const rawLbs = modifier > 0 ? totalWeightLbs / modifier : totalWeightLbs;
  
  const invertB = config?.invertBaseWeight ?? false;
  const invertW = config?.invertWeight ?? false;
  
  const plateLbs = (rawLbs - (invertB ? -1 : 1) * baseLbs) * (invertW ? -1 : 1);
  const safePlateLbs = Math.max(0, plateLbs);
  
  if (targetUnit === 'kg') {
    const kg = safePlateLbs * 0.45359237;
    return String(Math.round(kg * 100) / 100);
  }
  return String(Math.round(safePlateLbs * 100) / 100);
};

const toLocalISOString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const DEGREES_OPTIONS = [{ value: '', label: 'None' }];
for (let i = 0; i <= 360; i += 5) {
  DEGREES_OPTIONS.push({ value: String(i), label: `${i}°` });
}
for (let i = -5; i >= -360; i -= 5) {
  DEGREES_OPTIONS.push({ value: String(i), label: `${i}°` });
}

export const calculatePushUpPercentage = (angle: number, isKneeled: boolean) => {
  if (isKneeled) {
    return 54.0;
  }
  
  // Percentage = 74.22 - (0.287 * Alpha) - (0.0031 * (Alpha^2)) + (0.00003 * (Alpha^3))
  let percentage = 74.22 - (0.287 * angle) - (0.0031 * Math.pow(angle, 2)) + (0.00003 * Math.pow(angle, 3));
  
  // Clamp between 0% and 95%
  percentage = Math.max(0, Math.min(95, percentage));
  
  // Round to 1 decimal place
  return Math.round(percentage * 10) / 10;
};

export default function AddWorkoutForm({ 
  addSet, 
  updateSet,
  deleteSet,
  onSuccess, 
  initialExercise = '',
  initialVariant = '',
  initialPosture = '',
  initialWeightModifier,
  initialWeight,
  initialReps,
  initialDegrees,
  machineConfigs = [],
  saveMachineConfig,
  sets = [],
  onExerciseRename,
  onNavigateToTab
}: AddWorkoutFormProps) {
  const { theme } = useTheme();
  const { dbUser, incrementPremiumUses } = useAuth();

  const [showPremiumUpgradeModal, setShowPremiumUpgradeModal] = useState(false);
  const [showApiKeyMissingModal, setShowApiKeyMissingModal] = useState(false);
  const formDraftKey = useMemo(() => `workout-draft-${initialExercise.replace(/\s+/g, '-').toLowerCase() || 'default'}`, [initialExercise]);

  const [exercise, setExercise] = useState(initialExercise === '__NEW_MACHINE__' ? '' : initialExercise);
  
  const [variant, setVariant] = useState<string>(initialVariant || '');
  const [posture, setPosture] = useState<string>(initialPosture || '');
  const [weightModifier, setWeightModifier] = useState<string>(initialWeightModifier !== undefined && initialWeightModifier !== null ? String(initialWeightModifier) : '');
  const [reps, setReps] = useState<string>(initialReps !== undefined && initialReps !== null ? String(initialReps) : '');
  const [unit, setUnit] = useLocalStorageState<'lbs' | 'kg'>(`${formDraftKey}-unit`, 'lbs');
  const [bodyWeightKg] = useLocalStorageState<number | null>('user-bodyweight', null);

  const [weight, setWeight] = useState<string>(() => {
    if (initialWeight !== undefined && initialWeight !== null) {
      const activeExercise = initialExercise === '__NEW_MACHINE__' ? '' : initialExercise;
      const savedUnit = window.localStorage.getItem(`${formDraftKey}-unit`);
      const targetUnit: 'lbs' | 'kg' = (savedUnit === '"kg"' || savedUnit === 'kg') ? 'kg' : 'lbs';
      return getPlateWeight(initialWeight, activeExercise, machineConfigs, initialWeightModifier, targetUnit);
    }
    return '';
  });
  const [degrees, setDegrees] = useState<string>(initialDegrees !== undefined && initialDegrees !== null ? String(initialDegrees) : '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localType, setLocalType] = useState<'Machine' | 'Weightlifting' | 'Exercise'>('Machine');
  const isRotaryExercise = (initialExercise?.toLowerCase().includes('rotary') || initialExercise?.toLowerCase().includes('torso')) ?? false;
  const [showOptionalFields, setShowOptionalFields] = useState<boolean>(() => {
    return (initialDegrees !== undefined && initialDegrees !== null) || isRotaryExercise;
  });
  const [customDateTime, setCustomDateTime] = useState<string>(toLocalISOString(new Date()));
  const [customFieldsValues, setCustomFieldsValues] = useState<Record<string, string>>({});

  const [workoutMode, setWorkoutMode] = useState<'Volume' | 'Strength' | 'Speed' | 'Endurance' | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<{
    fiberType: string;
    reasoning: string;
    recommendedReps: string;
    recommendedSets: number;
    recommendedRestSeconds?: number;
    weightAdjustment: {
      direction: 'increase' | 'decrease' | 'maintain';
      percentage: number;
      lbsValue: number;
      kgValue: number;
      explanation: string;
    };
    isFallback?: boolean;
  } | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  useEffect(() => {
    if (exercise) {
      const config = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
      if (config?.type) {
        setLocalType(config.type);
      } else {
        const defaultMac = MACHINES.find(m => m.name.toLowerCase() === exercise.toLowerCase());
        setLocalType(defaultMac?.type as 'Machine' | 'Weightlifting' | 'Exercise' || 'Machine');
      }
    }
  }, [exercise, machineConfigs]);

  const pushUpPercentage = useMemo(() => {
    const isPushUp = exercise?.toLowerCase().replace('-', ' ').includes('push up');
    if (isPushUp) {
      const angle = degrees ? parseFloat(degrees) : 0;
      const isKneeled = posture?.toLowerCase() === 'kneeled' || posture?.toLowerCase() === 'on knees';
      return calculatePushUpPercentage(angle, isKneeled);
    }
    return null;
  }, [exercise, degrees, posture]);

  // Auto-calculate weight for push-ups when posture or degrees change
  useEffect(() => {
    const isPushUp = exercise?.toLowerCase().replace('-', ' ').includes('push up');
    if (isPushUp) {
      const angle = degrees ? parseFloat(degrees) : 0;
      const isKneeled = posture?.toLowerCase() === 'kneeled' || posture?.toLowerCase() === 'on knees';
      const percentage = calculatePushUpPercentage(angle, isKneeled);
      
      setWeightModifier(String(percentage));
    }
  }, [degrees, posture, exercise, bodyWeightKg, unit]);

  const formTagPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isFormTagLongPressed = useRef(false);

  const startFormTagPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isFormTagLongPressed.current = false;
    formTagPressTimer.current = setTimeout(async () => {
      isFormTagLongPressed.current = true;
      let targetNewType: 'Machine' | 'Weightlifting' | 'Exercise' = 'Machine';
      if (localType === 'Machine') {
        targetNewType = 'Weightlifting';
      } else if (localType === 'Weightlifting') {
        targetNewType = 'Exercise';
      } else {
        targetNewType = 'Machine';
      }
      setLocalType(targetNewType);

      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      if (saveMachineConfig && exercise) {
        const existing = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
        const baseLbs = existing?.baseWeightLbs || 0;
        const baseKg = existing?.baseWeightKg || 0;
        const brand = existing?.brand || 'Standard';
        const category = existing?.category || 'Custom';
        const variantCategories = existing?.variantCategories || {};
        
        try {
          await saveMachineConfig(
            exercise,
            baseLbs,
            baseKg,
            brand,
            category,
            variantCategories,
            targetNewType
          );
        } catch (error) {
          console.error("Failed to toggle type via label long-press:", error);
        }
      }
    }, 600);
  };

  const endFormTagPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (formTagPressTimer.current) {
      clearTimeout(formTagPressTimer.current);
    }
  };

  const handleFormTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  // Find current active machine config
  const activeConfig = useMemo(() => {
    if (!exercise || !machineConfigs) return null;
    return machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase()) || null;
  }, [exercise, machineConfigs]);

  const [manualBaseWeight, setManualBaseWeight] = useLocalStorageState<string | null>(`${formDraftKey}-baseweight`, null);
  const [invertWeight, setInvertWeight] = useLocalStorageState<boolean>(`${formDraftKey}-invertWeight`, false);
  const [invertBaseWeight, setInvertBaseWeight] = useLocalStorageState<boolean>(`${formDraftKey}-invertBaseWeight`, false);

  // Sync with machine config when exercise changes
  useEffect(() => {
    if (activeConfig) {
      if (activeConfig.invertWeight !== undefined) setInvertWeight(activeConfig.invertWeight);
      if (activeConfig.invertBaseWeight !== undefined) setInvertBaseWeight(activeConfig.invertBaseWeight);
    }
  }, [activeConfig, setInvertWeight, setInvertBaseWeight]);


  const handleUnitChange = (newUnit: 'lbs' | 'kg') => {
    if (newUnit === unit) return;

    if (weight) {
      const parsed = parseFloat(weight);
      if (!isNaN(parsed) && parsed > 0) {
        const converted = newUnit === 'kg' ? parsed * 0.453592 : parsed * 2.20462;
        setWeight(String(roundToTwo(converted)));
      }
    }

    if (manualBaseWeight) {
      const parsedBase = parseFloat(manualBaseWeight);
      if (!isNaN(parsedBase) && parsedBase > 0) {
        const convertedBase = newUnit === 'kg' ? parsedBase * 0.453592 : parsedBase * 2.20462;
        setManualBaseWeight(String(roundToTwo(convertedBase)));
      }
    } else {
      const config = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
      if (config) {
        const newVal = newUnit === 'lbs' ? config.baseWeightLbs : config.baseWeightKg;
        if (newVal > 0) {
          setManualBaseWeight(String(roundToTwo(newVal)));
        }
      }
    }

    setUnit(newUnit);
  };

  // History mode and Edit action state properties
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [selectedSetToEditId, setSelectedSetToEditId] = useState<string | null>(null);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Quick edit states for dates
  const [quickEditSet, setQuickEditSet] = useState<WorkoutSet | null>(null);
  const [quickEditGroup, setQuickEditGroup] = useState<string | null>(null);
  const [quickEditDate, setQuickEditDate] = useState('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const headerPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isHeaderLongPressed = useRef(false);

  useEffect(() => {
    return () => {
      if (headerPressTimer.current) {
        clearTimeout(headerPressTimer.current);
      }
    };
  }, []);

  // Compute selectedSetToEdit from the sets list
  const selectedSetToEdit = useMemo(() => {
    if (!selectedSetToEditId) return null;
    return sets.find(s => s.id === selectedSetToEditId) || null;
  }, [sets, selectedSetToEditId]);

  // Filter sets specifically for the current machine
  const machineSets = useMemo(() => {
    if (!exercise || !sets) return [];
    // Sort reverse chronological
    return sets
      .filter(s => s.exercise.toLowerCase() === exercise.toLowerCase())
      .sort((a, b) => {
        const atime = a.date
          ? (typeof (a.date as any).toMillis === 'function'
              ? (a.date as any).toMillis()
              : (a.date instanceof Date ? a.date.getTime() : new Date(a.date as any).getTime()))
          : 0;
        const btime = b.date
          ? (typeof (b.date as any).toMillis === 'function'
              ? (b.date as any).toMillis()
              : (b.date instanceof Date ? b.date.getTime() : new Date(b.date as any).getTime()))
          : 0;
        return btime - atime;
      });
  }, [exercise, sets]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSetTimeMillis = (s: WorkoutSet): number => {
    const d = s.createdAt || s.date;
    if (!d) return Date.now();
    if (typeof (d as any).toMillis === 'function') return (d as any).toMillis();
    if (typeof (d as any).toDate === 'function') return (d as any).toDate().getTime();
    if ((d as any).seconds !== undefined) return (d as any).seconds * 1000;
    return new Date(d as any).getTime();
  };

  const getRestSecondsForExercise = (exerciseName: string) => {
    const standardMachine = MACHINES.find(m => m.name.toLowerCase() === exerciseName.toLowerCase());
    if (standardMachine) return standardMachine.restSeconds;
    return 120; // default for custom machines
  };

  const restSeconds = useMemo(() => {
    if (aiRecommendation?.recommendedRestSeconds) return aiRecommendation.recommendedRestSeconds;
    if (workoutMode === 'Volume') return 90;
    if (workoutMode === 'Strength') return 180;
    if (workoutMode === 'Speed') return 60;
    if (workoutMode === 'Endurance') return 45;
    return getRestSecondsForExercise(exercise);
  }, [exercise, workoutMode, aiRecommendation]);

  const restTimerInfo = useMemo(() => {
    const lastSet = machineSets[0];
    if (!lastSet) return { isResting: false, progress: 100, timeRemaining: 0 };
    const lastSetTime = getSetTimeMillis(lastSet);
    const timeSinceLastSet = (now - lastSetTime) / 1000;
    if (timeSinceLastSet >= 0 && timeSinceLastSet < restSeconds) {
      const progress = (timeSinceLastSet / restSeconds) * 100;
      const timeRemaining = Math.max(0, Math.ceil(restSeconds - timeSinceLastSet));
      return { isResting: true, progress, timeRemaining };
    }
    return { isResting: false, progress: 100, timeRemaining: 0 };
  }, [machineSets, restSeconds, now]);

  const isDark = useMemo(() => {
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, [theme]);

  const selectedMachineConfig = useMemo(() => {
    return machineConfigs?.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
  }, [machineConfigs, exercise]);

  const selectedMachineType = useMemo(() => {
    const standardMachine = MACHINES.find(m => m.name.toLowerCase() === exercise.toLowerCase());
    if (standardMachine) return standardMachine.type;
    if (selectedMachineConfig?.type) return selectedMachineConfig.type;
    return 'Machine';
  }, [exercise, selectedMachineConfig]);

  const selectedMachineCategory = useMemo(() => {
    const standardMachine = MACHINES.find(m => m.name.toLowerCase() === exercise.toLowerCase());
    if (standardMachine) return standardMachine.category;
    if (selectedMachineConfig?.category) return selectedMachineConfig.category;
    return 'Custom';
  }, [exercise, selectedMachineConfig]);

  const selectedMachineFatigueScore = useMemo(() => {
    const globalFatigueScores = calculateFatigueScores(sets || [], machineConfigs || []);
    
    let score = 0;
    if (selectedMachineConfig?.linkedMuscles && selectedMachineConfig.linkedMuscles.length > 0) {
      let maxF = 0;
      selectedMachineConfig.linkedMuscles.forEach(mid => {
        if (globalFatigueScores[mid] > maxF) maxF = globalFatigueScores[mid];
      });
      score = maxF;
    } else if (selectedMachineConfig?.linkedGroups && selectedMachineConfig.linkedGroups.length > 0) {
      let maxF = 0;
      selectedMachineConfig.linkedGroups.forEach(g => {
        if (globalFatigueScores[g] > maxF) maxF = globalFatigueScores[g];
      });
      score = maxF;
    } else if (selectedMachineCategory && selectedMachineCategory !== 'Custom') {
      score = globalFatigueScores[selectedMachineCategory] || 0;
    } else {
      // Fallback for purely custom machines with no links
      const fatigueWindowMs = 168 * 3600 * 1000;
      const recentCount = machineSets.filter(s => {
        const time = getSetTimeMillis(s);
        return (now - time) < fatigueWindowMs;
      }).length;
      if (recentCount > 4) score = 0.8;
      else if (recentCount > 2) score = 0.5;
      else if (recentCount > 0) score = 0.2;
    }
    return score;
  }, [sets, machineConfigs, selectedMachineConfig, selectedMachineCategory, machineSets, now]);

  const fillHexColor = useMemo(() => {
    if (selectedMachineFatigueScore > 0) {
      if (selectedMachineFatigueScore <= 0.3) {
        return '#4ade80'; // Green
      } else if (selectedMachineFatigueScore <= 0.7) {
        return '#f59e0b'; // Amber
      } else {
        return '#ef4444'; // Red
      }
    }
    // Default fallback color depending on type
    if (selectedMachineType === 'Exercise') return '#a855f7'; // Purple
    if (selectedMachineType === 'Weightlifting') return '#f43f5e'; // Rose
    return '#06b6d4'; // Cyan/Sky
  }, [selectedMachineFatigueScore, selectedMachineType]);

  // Group machineSets by date in a tree structure (Arborescence)
  const groupedSets = useMemo(() => {
    const groups: { [dateStr: string]: WorkoutSet[] } = {};
    machineSets.forEach((s) => {
      if (!s.date) return;
      const jsDate = (s.date as any).toDate ? (s.date as any).toDate() : new Date(s.date as any);
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      const dateStr = jsDate.toLocaleDateString(undefined, options);
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(s);
    });
    return groups;
  }, [machineSets]);

  // Safe reset when entering history mode to always show the history list
  useEffect(() => {
    if (isHistoryMode) {
      setSelectedSetToEditId(null);
    }
  }, [isHistoryMode]);

  // Android Back Button handling for AddWorkoutForm states
  useEffect(() => {
    if (showDeleteConfirm) {
      return backButtonManager.register('workout-delete-confirm', 100, () => {
        setShowDeleteConfirm(false);
        return true;
      });
    }
    if (showConfirmPrompt) {
      return backButtonManager.register('workout-confirm-prompt', 95, () => {
        setShowConfirmPrompt(false);
        return true;
      });
    }
    if (showApiKeyMissingModal) {
      return backButtonManager.register('workout-apikey-missing', 90, () => {
        setShowApiKeyMissingModal(false);
        return true;
      });
    }
    if (showPremiumUpgradeModal) {
      return backButtonManager.register('workout-premium-upgrade', 90, () => {
        setShowPremiumUpgradeModal(false);
        return true;
      });
    }
    if (selectedSetToEditId) {
      return backButtonManager.register('workout-edit-set', 60, () => {
        setSelectedSetToEditId(null);
        return true;
      });
    }
    if (isHistoryMode) {
      return backButtonManager.register('workout-history-mode', 50, () => {
        setIsHistoryMode(false);
        return true;
      });
    }
  }, [showDeleteConfirm, showConfirmPrompt, showApiKeyMissingModal, showPremiumUpgradeModal, selectedSetToEditId, isHistoryMode]);

  // Native Audio Engine, Background KeepAlive & MediaSession Rest Timer Integration
  const previousTimeRemainingRef = useRef<number | null>(null);
  const wasRestingRef = useRef<boolean>(false);

  useEffect(() => {
    const { isResting, timeRemaining } = restTimerInfo;

    if (isResting) {
      audioManager.startBackgroundKeepAlive();
      audioManager.updateRestTimerMediaSession(exercise, timeRemaining, restSeconds, {
        onSkip: () => {
          // MediaSession skip
        },
      });

      // Countdown warning pips at 3, 2, 1
      if (previousTimeRemainingRef.current !== timeRemaining) {
        if (timeRemaining === 3 || timeRemaining === 2 || timeRemaining === 1) {
          audioManager.playCountdownBeep(timeRemaining);
          if (navigator.vibrate) navigator.vibrate(40);
        }
        previousTimeRemainingRef.current = timeRemaining;
      }
      wasRestingRef.current = true;
    } else {
      if (wasRestingRef.current) {
        audioManager.playRestCompleteFanfare();
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        audioManager.speak(`Repos terminé. Série suivante : ${exercise}`);
        audioManager.stopBackgroundKeepAlive();
        audioManager.clearMediaSession();
        wasRestingRef.current = false;
        previousTimeRemainingRef.current = null;
      }
    }
  }, [restTimerInfo.isResting, restTimerInfo.timeRemaining, exercise, restSeconds]);

  useEffect(() => {
    return () => {
      audioManager.stopBackgroundKeepAlive();
      audioManager.clearMediaSession();
    };
  }, []);

  const startHeaderPress = (e: React.MouseEvent | React.TouchEvent, dateStr: string) => {
    isHeaderLongPressed.current = false;
    headerPressTimer.current = setTimeout(() => {
      isHeaderLongPressed.current = true;
      
      if (navigator.vibrate) {
        navigator.vibrate(60);
      }

      // Open quick edit for the group
      const setsInGroup = groupedSets[dateStr];
      if (setsInGroup && setsInGroup.length > 0) {
        const firstSet = setsInGroup[0];
        const jsDate = firstSet.date.toDate ? firstSet.date.toDate() : new Date(firstSet.date as any);
        const yyyy = jsDate.getFullYear();
        const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
        const dd = String(jsDate.getDate()).padStart(2, '0');
        setQuickEditDate(`${yyyy}-${mm}-${dd}`);
        setQuickEditGroup(dateStr);
      }
    }, 600); // 600ms hold
  };

  const endHeaderPress = () => {
    if (headerPressTimer.current) {
      clearTimeout(headerPressTimer.current);
    }
  };

  const handleQuickSaveSingleSetDate = async () => {
    if (!quickEditSet || !quickEditSet.id || !updateSet || !quickEditDate) return;
    setIsQuickSaving(true);
    try {
      const [y, m, d] = quickEditDate.split('-').map(Number);
      const originalDate = quickEditSet.date.toDate ? quickEditSet.date.toDate() : new Date(quickEditSet.date as any);
      const updatedDate = new Date(y, m - 1, d, originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());

      await updateSet(quickEditSet.id, {
        date: Timestamp.fromDate(updatedDate),
      });

      setQuickEditSet(null);
      setQuickEditDate('');
    } catch (err) {
      console.error('Failed to quick save single set date:', err);
    } finally {
      setIsQuickSaving(false);
    }
  };

  const handleQuickSaveGroupDates = async () => {
    if (!quickEditGroup || !updateSet || !quickEditDate) return;
    const setsToUpdate = groupedSets[quickEditGroup];
    if (!setsToUpdate || setsToUpdate.length === 0) return;

    setIsQuickSaving(true);
    try {
      const [y, m, d] = quickEditDate.split('-').map(Number);
      const promises = setsToUpdate.map(async (set) => {
        if (!set.id) return;
        const originalDate = set.date.toDate ? set.date.toDate() : new Date(set.date as any);
        const updatedDate = new Date(y, m - 1, d, originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
        return updateSet(set.id, {
          date: Timestamp.fromDate(updatedDate),
        });
      });

      await Promise.all(promises);
      setQuickEditGroup(null);
      setQuickEditDate('');
    } catch (err) {
      console.error('Failed to quick save group dates:', err);
    } finally {
      setIsQuickSaving(false);
    }
  };

  const formatDateTime = (ts: any) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (_) {
      return '';
    }
  };

  const handleSelectSetForEdit = (set: WorkoutSet) => {
    setSelectedSetToEditId(set.id || null);
    setShowDeleteConfirm(false);
    setVariant(set.variant || '');
    setPosture(set.posture || '');
    setWeightModifier(set.weightModifier !== undefined && set.weightModifier !== null ? String(set.weightModifier) : '100');
    setReps(set.reps !== undefined && set.reps !== null ? String(set.reps) : '');
    
    // Total weight needs to be reverted to the plate value
    const baseWeightVal = parseFloat(activeBaseWeight) || 0;
    const recordedTotalWeight = unit === 'lbs' ? set.weightLbs : set.weightKg;
    const calculatedPlateWeight = Math.round(Math.max(0, recordedTotalWeight - baseWeightVal) * 100) / 100;
    setWeight(calculatedPlateWeight !== undefined && calculatedPlateWeight !== null ? String(calculatedPlateWeight) : '');
    
    setDegrees(set.degrees !== undefined && set.degrees !== null ? String(set.degrees) : '');
    setCustomFieldsValues(set.customFields || {});

    const jsDate = set.date.toDate ? set.date.toDate() : new Date(set.date as any);
    const yyyy = jsDate.getFullYear();
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    setEditDate(`${yyyy}-${mm}-${dd}`);
    setCustomDateTime(toLocalISOString(jsDate));
  };

  const handleSaveEditSet = async () => {
    console.log("handleSaveEditSet Triggered", { selectedSetToEditId, hasUpdateSet: !!updateSet, reps, weight, customDateTime });
    if (!selectedSetToEdit || !selectedSetToEdit.id || !updateSet) return;
    
    // Treat empty weight as "0" to prevent preventing saves for purely bodyweight or 0-plate entries
    const safeWeight = weight === '' ? '0' : weight;
    
    if (reps === '' || !customDateTime) {
      console.warn("Returning early due to empty required fields", { reps, weight: safeWeight, customDateTime });
      alert("Please fill all required fields (reps, date & hour).");
      return;
    }

    try {
      const repCount = parseInt(reps);
      const weightVal = parseFloat(safeWeight) || 0;
      const baseWeightVal = parseFloat(activeBaseWeight) || 0;
      const modifier = weightModifier !== '' ? (parseFloat(weightModifier) || 100) / 100 : 1;
      const totalWeightVal = ((invertWeight ? -1 : 1) * weightVal + (invertBaseWeight ? -1 : 1) * baseWeightVal) * modifier;
      
      let weightLbs, weightKg;

      if (unit === 'lbs') {
        weightLbs = totalWeightVal;
        weightKg = totalWeightVal * 0.453592237;
      } else {
        weightKg = totalWeightVal;
        weightLbs = totalWeightVal * 2.20462262;
      }

      const updatedDate = customDateTime ? new Date(customDateTime) : new Date();

      const updatedSetData: any = {
        reps: repCount,
        weightLbs: roundToTwo(weightLbs),
        weightKg: roundToTwo(weightKg),
        degrees: degrees !== '' ? parseFloat(degrees) : null,
        variant: variant.trim() || null,
        posture: posture.trim() || null,
        weightModifier: weightModifier !== '' ? parseFloat(weightModifier) : null,
        customFields: Object.keys(customFieldsValues).length > 0 ? customFieldsValues : null,
        date: Timestamp.fromDate(updatedDate),
      };

      console.log('UPDATING SET ->', updatedSetData);
      await updateSet(selectedSetToEdit.id, updatedSetData);

      // Save machine config if checkboxes were modified during history edit
      if (saveMachineConfig && exercise) {
        const existing = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
        if (existing) {
          await saveMachineConfig(
            exercise, 
            existing.baseWeightLbs, 
            existing.baseWeightKg,
            existing.brand,
            existing.category,
            existing.variantCategories,
            existing.type,
            undefined,
            undefined,
            undefined,
            undefined,
            invertWeight,
            invertBaseWeight
          );
        }
      }
      
      setSelectedSetToEditId(null);
      setShowConfirmPrompt(false);
      setReps('');
      setWeight('');
      setDegrees('');
      setVariant('');
      setCustomFieldsValues({});
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Failed to update set:', err);
      alert('Failed to update: ' + (err.message || 'Unknown error'));
      setShowConfirmPrompt(false);
    }
  };

  const handleDeleteSet = async () => {
    if (!selectedSetToEdit || !selectedSetToEdit.id || !deleteSet) return;
    
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      await deleteSet(selectedSetToEdit.id);
      setSelectedSetToEditId(null);
      setReps('');
      setWeight('');
      setDegrees('');
      setVariant('');
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete set:', err);
    }
  };

  useEffect(() => {
    if (initialExercise) {
      setExercise(initialExercise === '__NEW_MACHINE__' ? '' : initialExercise);
    }
  }, [initialExercise]);

  // Reset manual edit whenever selected exercise changes
  useEffect(() => {
    if (!initialVariant) {
      setVariant('');
    } else {
      setVariant(initialVariant);
    }
    
    if (!initialPosture) {
      setPosture('');
    } else {
      setPosture(initialPosture);
    }
    
    if (initialWeightModifier !== undefined && initialWeightModifier !== null) {
      setWeightModifier(String(initialWeightModifier));
    } else {
      setWeightModifier('100');
    }
    
    if (initialReps !== undefined && initialReps !== null) {
      setReps(String(initialReps));
    } else {
      setReps('');
    }

    if (initialWeight !== undefined && initialWeight !== null) {
      const savedUnit = window.localStorage.getItem(`${formDraftKey}-unit`);
      const targetUnit: 'lbs' | 'kg' = (savedUnit === '"kg"' || savedUnit === 'kg') ? 'kg' : 'lbs';
      setWeight(getPlateWeight(initialWeight, exercise, machineConfigs, initialWeightModifier, targetUnit));
    } else {
      setWeight('');
    }

    if (initialDegrees !== undefined && initialDegrees !== null) {
      setDegrees(String(initialDegrees));
    } else {
      setDegrees('');
    }
  }, [exercise, initialVariant, initialReps, initialWeight, initialDegrees, formDraftKey, machineConfigs, initialWeightModifier]);

  // Determine previously used variants for suggestions
  const existingVariants = useMemo(() => {
    if (!exercise || !sets) return [];
    return Array.from(new Set(
      sets
        .filter(s => s.exercise.toLowerCase() === exercise.toLowerCase() && s.variant)
        .map(s => s.variant!)
    )).filter(Boolean);
  }, [exercise, sets]);

  // Determine active base weight to show based on config and unit
  const activeBaseWeight = useMemo(() => {
    if (manualBaseWeight !== null) return manualBaseWeight;
    if (!exercise || !machineConfigs) return '';
    const config = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
    if (config) {
      return unit === 'lbs' ? String(config.baseWeightLbs) : String(config.baseWeightKg);
    }
    return '';
  }, [exercise, machineConfigs, unit, manualBaseWeight]);

  // Key generators for persistent training modes and AI cache
  const getWorkoutModeStorageKey = (ex: string) => `gym_workout_mode_${dbUser?.uid || 'guest'}_${ex.toLowerCase().trim()}`;
  const getGlobalModeStorageKey = () => `gym_workout_mode_global_${dbUser?.uid || 'guest'}`;
  const getAiCacheKey = (ex: string, mode: string) => `gym_ai_cache_${dbUser?.uid || 'guest'}_${ex.toLowerCase().trim()}_${mode}`;

  const fetchOrLoadAiRecommendation = async (mode: 'Volume' | 'Strength' | 'Speed' | 'Endurance', forceRefresh = false) => {
    if (!exercise) return;

    let topWeightLbs = 0;
    let topRepsAtMax = 0;
    machineSets.forEach(s => {
      const w = s.weightLbs || 0;
      if (w > topWeightLbs) {
        topWeightLbs = w;
        topRepsAtMax = s.reps || 0;
      } else if (w === topWeightLbs && (s.reps || 0) > topRepsAtMax) {
        topRepsAtMax = s.reps || 0;
      }
    });

    const cacheKey = getAiCacheKey(exercise, mode);
    const cachedRaw = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null;
    let cache: any = null;
    if (cachedRaw) {
      try { cache = JSON.parse(cachedRaw); } catch (e) { cache = null; }
    }

    const isWeightProgress = cache && topWeightLbs > (cache.topWeightLbs || 0) * 1.05;
    const isRepProgress = cache && topWeightLbs >= (cache.topWeightLbs || 0) && topRepsAtMax >= (cache.topRepsAtMax || 0) + 2;
    const isStale = !cache || (Date.now() - (cache.timestamp || 0)) > 7 * 24 * 3600 * 1000;

    const needsApiCall = forceRefresh || !cache || isWeightProgress || isRepProgress || isStale;

    if (!needsApiCall && cache?.recommendation) {
      setAiRecommendation(cache.recommendation);
      setRecommendationError(null);
      setLoadingRecommendation(false);
      return;
    }

    const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
    const isPremium = !!dbUser?.isPremium || !!localKey;
    const currentUses = dbUser?.premiumUses ?? 0;
    const hasPremiumAccess = isPremium || currentUses < 5;

    if (!hasPremiumAccess) {
      setShowPremiumUpgradeModal(true);
      setLoadingRecommendation(false);
      return;
    }

    if (!isPremium) {
      try {
        await incrementPremiumUses();
      } catch (err) {
        console.error("Failed to increment usage count:", err);
      }
    }

    setRecommendationError(null);
    setLoadingRecommendation(true);

    try {
      const lightweightSets = machineSets.slice(0, 10).map(s => ({
        reps: s.reps,
        weightLbs: s.weightLbs,
        weightKg: s.weightKg,
        date: s.createdAt || s.date 
          ? (typeof (s.createdAt || s.date as any).toMillis === 'function' 
              ? new Date((s.createdAt || s.date as any).toMillis()).toLocaleDateString() 
              : new Date(s.createdAt as any || s.date as any).toLocaleDateString()) 
          : undefined,
        variant: s.variant,
        posture: s.posture,
        isSameExercise: true
      }));

      // If user has few sets for this specific exercise, supplement with recent sets from same muscle group
      if (lightweightSets.length < 3 && selectedMachineCategory && sets) {
        const catSets = sets
          .filter(s => (s.category || '').toLowerCase() === selectedMachineCategory.toLowerCase() && s.exercise.toLowerCase() !== exercise.toLowerCase())
          .slice(0, 5)
          .map(s => ({
            exercise: s.exercise,
            reps: s.reps,
            weightLbs: s.weightLbs,
            weightKg: s.weightKg,
            category: s.category,
            isSameExercise: false
          }));
        lightweightSets.push(...catSets as any);
      }

      const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
      const customKey = localKey || dbUser?.geminiApiKey || "";

      const data = await fetchAiAnalyzeMode(
        {
          exercise,
          mode,
          recentSets: lightweightSets,
          category: selectedMachineCategory,
          type: selectedMachineType
        },
        customKey
      );

      setAiRecommendation(data);

      window.localStorage.setItem(cacheKey, JSON.stringify({
        recommendation: data,
        topWeightLbs,
        topRepsAtMax,
        mode,
        timestamp: Date.now()
      }));
    } catch (err: any) {
      console.error(err);
      if (err.message === "GEMINI_API_KEY_MISSING") {
        setRecommendationError("Gemini API Key missing or invalid. Please check settings.");
      } else {
        setRecommendationError(err.message || "Something went wrong.");
      }
    } finally {
      setLoadingRecommendation(false);
    }
  };

  useEffect(() => {
    if (!exercise) return;
    const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
    const isPremium = !!dbUser?.isPremium || !!localKey;
    const currentUses = dbUser?.premiumUses ?? 0;
    const hasPremiumAccess = isPremium || currentUses < 5;

    if (hasPremiumAccess) {
      const savedExMode = window.localStorage.getItem(getWorkoutModeStorageKey(exercise));
      const savedGlobalMode = window.localStorage.getItem(getGlobalModeStorageKey());
      const activeSavedMode = (savedExMode || savedGlobalMode) as 'Volume' | 'Strength' | 'Speed' | 'Endurance' | null;

      if (activeSavedMode && ['Volume', 'Strength', 'Speed', 'Endurance'].includes(activeSavedMode)) {
        if (workoutMode !== activeSavedMode) {
          setWorkoutMode(activeSavedMode);
        }
        fetchOrLoadAiRecommendation(activeSavedMode, false);
      }
    }
  }, [exercise, dbUser?.uid]);

  const handleModeClick = async (mode: 'Volume' | 'Strength' | 'Speed' | 'Endurance') => {
    if (workoutMode === mode) {
      setWorkoutMode(null);
      setAiRecommendation(null);
      setRecommendationError(null);
      if (exercise) {
        window.localStorage.removeItem(getWorkoutModeStorageKey(exercise));
      }
      return;
    }

    setWorkoutMode(mode);
    if (exercise) {
      window.localStorage.setItem(getWorkoutModeStorageKey(exercise), mode);
      window.localStorage.setItem(getGlobalModeStorageKey(), mode);
    }

    await fetchOrLoadAiRecommendation(mode, false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeWeight = weight === '' ? '0' : weight;
    if (!exercise || reps === '') return;

    setIsSubmitting(true);
    try {
      const repCount = parseInt(reps);
      const weightVal = parseFloat(safeWeight) || 0;
      const baseWeightVal = parseFloat(activeBaseWeight) || 0;
      const modifier = weightModifier !== '' ? (parseFloat(weightModifier) || 100) / 100 : 1;
      const totalWeightVal = ((invertWeight ? -1 : 1) * weightVal + (invertBaseWeight ? -1 : 1) * baseWeightVal) * modifier;
      
      let weightLbs, weightKg;

      if (unit === 'lbs') {
        weightLbs = totalWeightVal;
        weightKg = totalWeightVal * 0.453592;
      } else {
        weightKg = totalWeightVal;
        weightLbs = totalWeightVal * 2.20462;
      }

      // Save baseline weight configuration to Firestore as standard default
      if (saveMachineConfig && exercise) {
        let baseLbs, baseKg;
        if (unit === 'lbs') {
          baseLbs = baseWeightVal;
          baseKg = baseWeightVal * 0.453592;
        } else {
          baseKg = baseWeightVal;
          baseLbs = baseWeightVal * 2.20462;
        }
        const existing = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
        const brand = existing?.brand || 'Standard';
        const category = existing?.category || 'Custom';
        const variantCategories = existing?.variantCategories || {};
        await saveMachineConfig(
          exercise, 
          roundToTwo(baseLbs), 
          roundToTwo(baseKg),
          brand,
          category,
          variantCategories,
          localType,
          undefined,
          undefined,
          undefined,
          undefined,
          invertWeight,
          invertBaseWeight
        );
      }

      const targetDate = customDateTime ? new Date(customDateTime) : new Date();

      await addSet({
        exercise,
        reps: repCount,
        weightLbs: roundToTwo(weightLbs),
        weightKg: roundToTwo(weightKg),
        degrees: degrees !== '' ? parseFloat(degrees) : undefined,
        variant: variant.trim() || undefined,
        posture: posture.trim() || undefined,
        weightModifier: weightModifier !== '' ? parseFloat(weightModifier) : undefined,
        customFields: Object.keys(customFieldsValues).length > 0 ? customFieldsValues : undefined,
        date: Timestamp.fromDate(targetDate)
      });
      
      setVariant('');
      audioManager.playSetLoggedSound();
      if (navigator.vibrate) {
        navigator.vibrate([40, 30, 40]);
      }
      if (workoutMode && exercise) {
        fetchOrLoadAiRecommendation(workoutMode, true);
      }
      onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isHistoryMode) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
          <button
            type="button"
            onClick={() => {
              setIsHistoryMode(false);
              setSelectedSetToEditId(null);
            }}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg">
              {selectedSetToEdit ? `Edit Set for ${exercise}` : `${exercise} History`}
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">
              {selectedSetToEdit ? 'Modify reps, weight, degrees, or option' : 'Tap any registered set to edit details'}
            </p>
          </div>
        </div>

        {selectedSetToEdit ? (
          /* Editing form - pre-populated and matches same interface as the machine interface */
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                  Exercise Option / Variant <span className="text-gray-400 dark:text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={variant || ''}
                  onChange={(e) => setVariant(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-base font-medium text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="e.g. Left axis, right rotation, chest fly"
                />
              </div>

              <div className="grid grid-cols-[1fr_135px] sm:grid-cols-[1fr_150px] gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">Weight</label>
                  <div className="flex items-stretch relative h-[56px] z-30">
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={weight || ''}
                      onChange={(e) => setWeight(e.target.value)}
                      className="flex-1 w-full pl-3.5 pr-1 h-full py-0 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 border-r-0 rounded-l-2xl text-lg font-medium text-black dark:text-white focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white outline-none z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-[75px]"
                      placeholder="0"
                    />
                    <div className="w-[82px] sm:w-[95px] shrink-0 flex h-full">
                      <Dropdown
                        className="h-full z-20"
                        value={unit}
                        onChange={(val) => handleUnitChange(val as 'lbs' | 'kg')}
                        options={[
                          { value: 'lbs', label: 'lbs' },
                          { value: 'kg', label: 'kg' }
                        ]}
                        buttonClassName="w-full h-full flex items-center justify-between bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-r-2xl h-full py-0 px-2.5 sm:px-3 text-sm font-bold text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                        menuClassName="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 py-1.5 focus:outline-none right-0 min-w-[110px]"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">Reps</label>
                  <RepsInput
                    value={reps || ''}
                    onChange={(val) => setReps(val)}
                  />
                </div>
              </div>

              {/* Dynamic lift calculations */}
              {parseFloat(activeBaseWeight) > 0 && (
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 rounded-2xl p-4 text-emerald-800 dark:text-emerald-300 space-y-1.5 mt-2">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <span>Dynamic Lift Weight Tracker</span>
                    <span>Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-sm">
                    <span className="font-bold text-gray-900 dark:text-white bg-white/60 dark:bg-white/5 py-0.5 px-2 rounded">
                      {invertWeight ? '-' : ''}{weight || '0'} {unit}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-500 font-bold">
                      {invertBaseWeight ? '-' : '+'}
                    </span>
                    <span className="font-medium text-gray-600 dark:text-slate-400">
                      {activeBaseWeight} {unit} <span className="text-[10px] opacity-80">({localType === 'Exercise' ? 'body weight' : localType === 'Weightlifting' ? 'bar weight' : 'carriage baseline'})</span>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-500 font-bold">=</span>
                    {weightModifier !== '' && parseFloat(weightModifier) !== 100 && (
                      <>
                        <span className="text-gray-400 dark:text-slate-500 font-bold mx-0.5">×</span>
                        <span className="font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded text-xs">{weightModifier}%</span>
                        <span className="text-emerald-600 dark:text-emerald-500 font-bold">=</span>
                      </>
                    )}
                    <span className="font-black text-black dark:text-white font-mono">
                      {roundToTwo((((invertWeight ? -1 : 1) * (parseFloat(weight) || 0)) + ((invertBaseWeight ? -1 : 1) * (parseFloat(activeBaseWeight) || 0))) * (weightModifier !== '' ? (parseFloat(weightModifier) || 100) / 100 : 1))} {unit}
                    </span>
                  </div>
                </div>
              )}

              {/* Collapsible Optional & Custom Adjustment Fields section for editing */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalFields(!showOptionalFields)}
                  className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer select-none py-1 ml-1"
                >
                  {showOptionalFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showOptionalFields ? 'Hide Optional Tracking Specs' : 'Show Optional Tracking Specs...'}</span>
                </button>

                {showOptionalFields && (
                  <div className="mt-3.5 space-y-4 bg-gray-50/50 dark:bg-slate-900/20 p-4 border border-gray-100 dark:border-slate-800/60 rounded-2xl animate-in slide-in-from-top-3 duration-200">
                    
                    {/* Optional Field: Degrees */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                        Degrees Option
                      </label>
                      <DegreeWheelPicker
                        value={degrees}
                        onChange={(val) => setDegrees(val)}
                        exerciseName={exercise}
                      />
                    </div>
                    
                    {/* Optional Field: Posture & Effective Weight */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                          Posture
                        </label>
                        {activeConfig?.postures && activeConfig.postures.length > 0 ? (
                          <Dropdown
                            value={posture}
                            onChange={(val) => {
                              if (val === '__NEW_POSTURE__') {
                                setPosture('');
                                setWeightModifier('100');
                              } else {
                                setPosture(val);
                                const selectedP = activeConfig.postures?.find(p => p.name === val);
                                if (selectedP) setWeightModifier(String(selectedP.weightModifier));
                              }
                            }}
                            options={[
                              ...activeConfig.postures.map(p => ({ label: p.name, value: p.name })),
                              { label: '+ Add New Posture', value: '__NEW_POSTURE__' }
                            ]}
                            placeholder={posture || "Posture"}
                          />
                        ) : (
                          <div>
                            <input
                              type="text"
                              value={posture || ''}
                              onChange={(e) => setPosture(e.target.value)}
                              className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-black outline-none"
                              placeholder="e.g. Kneeled"
                            />
                            {exercise?.toLowerCase() === 'push up' && (
                              <div className="flex flex-col gap-1.5 mt-2 ml-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 mr-1">Presets:</span>
                                  <button
                                    type="button"
                                    onClick={() => setPosture('Normal')}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                      posture.toLowerCase() === 'normal'
                                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                                        : 'border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-450 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    Normal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPosture('Kneeled')}
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                                      posture.toLowerCase() === 'kneeled'
                                        ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                                        : 'border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-450 hover:bg-gray-200 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    Kneeled
                                  </button>
                                </div>
                                {pushUpPercentage !== null && (
                                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    Effective weight: {pushUpPercentage}% of body weight
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                          Effective % Weight
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={weightModifier || ''}
                          onChange={(e) => setWeightModifier(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-black outline-none"
                          placeholder="100"
                        />
                      </div>
                    </div>

                    {/* Optional Field: Date & Hour for Antedating ("Antédater") */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1 flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-400 dark:text-slate-500" />
                        Date & Hour <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">(Antédater / Backdate if needed)</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 outline-none cursor-pointer"
                      />
                    </div>

                    {/* Dynamic Optional Fields Configured for this machine */}
                    {activeConfig?.customFields && activeConfig.customFields.length > 0 && (
                      <div className="space-y-3.5 pt-3.5 border-t border-gray-200 dark:border-slate-800">
                        <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                          Gear Adjustment Specs
                        </h5>
                        <div className="grid grid-cols-1 gap-3">
                          {activeConfig.customFields.map((field: string) => (
                            <div key={field}>
                              <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                                {field} <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">(Optional spec info)</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 3, Back, Low..."
                                value={customFieldsValues[field] || ''}
                                onChange={(e) => setCustomFieldsValues(prev => ({ ...prev, [field]: e.target.value }))}
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Machine-Wide Settings: Weight Inverter */}
                    <div className="space-y-3.5 pt-3.5 border-t border-gray-200 dark:border-slate-800">
                      <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                        Machine Settings (Applied Globally)
                      </h5>
                      <div className="flex flex-col gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-slate-300">
                          <input 
                            type="checkbox" 
                            checked={invertWeight} 
                            onChange={(e) => setInvertWeight(e.target.checked)}
                            className="w-4 h-4 rounded text-black focus:ring-black"
                          />
                          Invert Plate/Load Weight (Negative pull)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-slate-300">
                          <input 
                            type="checkbox" 
                            checked={invertBaseWeight} 
                            onChange={(e) => setInvertBaseWeight(e.target.checked)}
                            className="w-4 h-4 rounded text-black focus:ring-black"
                          />
                          Invert Base Weight (e.g. Chin Assist)
                        </label>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed border border-red-100 dark:border-red-900/10 animate-in fade-in slide-in-from-top-1">
                ⚠️ Are you sure you want to permanently delete this logged workout set? This action cannot be undone.
              </div>
            )}

            {/* Action buttons next to each other */}
            <div className="flex justify-between gap-3 pt-4">
              <button
                type="button"
                onClick={handleDeleteSet}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                  showDeleteConfirm 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md font-bold' 
                    : 'border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                }`}
              >
                <Trash2 size={16} /> {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSetToEditId(null);
                    setReps('');
                    setWeight('');
                    setVariant('');
                    setDegrees('');
                  }}
                  className="px-5 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-2xl text-sm font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmPrompt(true)}
                  className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
                >
                  Edit Set
                </button>
              </div>
            </div>

            {/* Custom confirmation action dialog overlay/window */}
            {showConfirmPrompt && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
                  <h4 className="text-xl font-black text-gray-900 dark:text-white">Confirm Modifications</h4>
                  <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                    Are you sure you want to save these modifications to the selected workout set retrospectively? This will update your charts and history analytics.
                  </p>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPrompt(false)}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEditSet}
                      className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md"
                    >
                      Confirm & Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Past Recorded Sets list - Grouped by Date (Arborescence) */
          <div className="space-y-6 max-h-[380px] overflow-y-auto pr-1 relative">
            {Object.keys(groupedSets).length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
                No past records found for this machine.
              </div>
            ) : (
              Object.entries(groupedSets).map(([dateStr, setsInGroup]) => (
                <div key={dateStr} className="space-y-3">
                  {/* Date section header node with long-press support */}
                  <div 
                    onMouseDown={(e) => startHeaderPress(e, dateStr)}
                    onTouchStart={(e) => startHeaderPress(e, dateStr)}
                    onMouseUp={endHeaderPress}
                    onTouchEnd={endHeaderPress}
                    onMouseLeave={endHeaderPress}
                    className="flex items-center gap-2 pl-1 select-none cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/40 p-1 rounded-lg max-w-max group transition-all"
                    title="Hold down to batch-update the date for all sets under this group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shrink-0 group-hover:scale-125 group-hover:bg-amber-500 transition-all animate-none" />
                    <span className="text-xs font-black text-gray-800 dark:text-slate-200 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      {dateStr}
                      <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 lowercase opacity-0 group-hover:opacity-100 transition-opacity font-sans normal-case ml-1">
                        (hold to change date for all)
                      </span>
                    </span>
                  </div>
                  
                  {/* Tree-connector branch container */}
                  <div className="relative pl-4 space-y-2.5 border-l-2 border-gray-100 dark:border-slate-800/80 ml-2.5 pb-1">
                    {(setsInGroup as WorkoutSet[]).map((prevSet) => {
                      const jsDate = (prevSet.date as any).toDate ? (prevSet.date as any).toDate() : new Date(prevSet.date as any);
                      const timeStr = jsDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={prevSet.id}
                          type="button"
                          onClick={() => handleSelectSetForEdit(prevSet)}
                          className="w-full text-left bg-gray-50 dark:bg-slate-950 p-4 border border-gray-150 dark:border-slate-800/60 rounded-2xl hover:border-black dark:hover:border-white hover:bg-white dark:hover:bg-slate-900 transition-all group flex justify-between items-center relative"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-gray-900 dark:text-white text-base">
                                {prevSet.reps} reps
                              </span>
                              <span className="text-gray-400 dark:text-slate-500 font-bold">•</span>
                              <span className="font-bold text-gray-800 dark:text-slate-200">
                                {prevSet.weightLbs.toFixed(1)} lbs
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-2xs text-gray-400 dark:text-slate-500 font-bold font-mono">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  // Open quick date editor for this set
                                  const jsDate = prevSet.date.toDate ? prevSet.date.toDate() : new Date(prevSet.date as any);
                                  const yyyy = jsDate.getFullYear();
                                  const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
                                  const dd = String(jsDate.getDate()).padStart(2, '0');
                                  setQuickEditDate(`${yyyy}-${mm}-${dd}`);
                                  setQuickEditSet(prevSet);
                                }}
                                className="bg-gray-150 hover:bg-black hover:text-white dark:bg-slate-800 dark:hover:bg-white dark:hover:text-black hover:scale-105 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 transition-all"
                                title="Click to change date"
                              >
                                <Calendar size={10} />
                                <span>{timeStr}</span>
                              </span>
                              {prevSet.degrees !== undefined && prevSet.degrees !== null && (
                                <>
                                  <span>•</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                    Number(prevSet.degrees) > 0 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      : Number(prevSet.degrees) < 0
                                      ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                                      : 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-450 border-orange-200 dark:border-orange-800'
                                  }`}>
                                    {Number(prevSet.degrees) > 0 ? `+${prevSet.degrees}° (Left)` : Number(prevSet.degrees) < 0 ? `${prevSet.degrees}° (Right)` : `0° (Center)`}
                                  </span>
                                </>
                              )}
                              {prevSet.customFields && Object.entries(prevSet.customFields).map(([key, val]) => (
                                <React.Fragment key={key}>
                                  <span>•</span>
                                  <span className="bg-amber-50 dark:bg-amber-955/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                    {key}: {val}
                                  </span>
                                </React.Fragment>
                              ))}
                              {prevSet.variant && (
                                <>
                                  <span>•</span>
                                  <span className="bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded text-[10px] font-extrabold text-sky-600 dark:text-sky-450 tracking-wide uppercase">
                                    {prevSet.variant}
                                  </span>
                                </>
                              )}
                              {prevSet.posture && (
                                <>
                                  <span>•</span>
                                  <span className="bg-fuchsia-50 dark:bg-fuchsia-950/20 px-1.5 py-0.5 rounded text-[10px] font-extrabold text-fuchsia-600 dark:text-fuchsia-400 tracking-wide uppercase">
                                    {prevSet.posture} {prevSet.weightModifier ? `(${prevSet.weightModifier}%)` : ''}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-gray-150/60 dark:bg-slate-800 group-hover:bg-black group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black text-gray-400 transition-all shrink-0">
                            <Edit2 size={12} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Quick Edit Single Set Date Modal Dialog overlay */}
            {quickEditSet && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Calendar size={20} className="stroke-[2.5px]" />
                    <h4 className="text-lg font-black text-gray-900 dark:text-white">Change Set Date</h4>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                    Choose a new date to move this individual set retrospectively:
                  </p>
                  <div>
                    <input
                      type="date"
                      required
                      value={quickEditDate}
                      onChange={(e) => setQuickEditDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isQuickSaving}
                      onClick={() => {
                        setQuickEditSet(null);
                        setQuickEditDate('');
                      }}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isQuickSaving || !quickEditDate}
                      onClick={handleQuickSaveSingleSetDate}
                      className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                    >
                      {isQuickSaving ? 'Saving...' : 'Update Date'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Edit Group Date Modal Dialog overlay */}
            {quickEditGroup && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                    <Calendar size={20} className="stroke-[2.5px]" />
                    <h4 className="text-lg font-black text-gray-900 dark:text-white">Batch Change Dates</h4>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                    You are moving all <span className="font-extrabold text-black dark:text-white">{(groupedSets[quickEditGroup] || []).length} sets</span> from <span className="font-semibold text-gray-800 dark:text-slate-200 font-mono text-xs">{quickEditGroup}</span> to a new date:
                  </p>
                  <div>
                    <input
                      type="date"
                      required
                      value={quickEditDate}
                      onChange={(e) => setQuickEditDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white outline-none focus:ring-2 focus:ring-violet-600 dark:focus:ring-violet-400 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isQuickSaving}
                      onClick={() => {
                        setQuickEditGroup(null);
                        setQuickEditDate('');
                      }}
                      className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isQuickSaving || !quickEditDate}
                      onClick={handleQuickSaveGroupDates}
                      className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                    >
                      {isQuickSaving ? 'Moving...' : 'Move All Sets'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 ml-1 select-none">
            <button
              type="button"
              title="Long press to toggle"
              onMouseDown={startFormTagPress}
              onTouchStart={startFormTagPress}
              onMouseUp={endFormTagPress}
              onTouchEnd={endFormTagPress}
              onMouseLeave={endFormTagPress}
              onClick={handleFormTagClick}
              className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md active:scale-95 transition-all duration-150 cursor-pointer ${
                localType === 'Machine'
                  ? 'bg-cyan-50 border border-cyan-150/40 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/35'
                  : localType === 'Weightlifting'
                  ? 'bg-rose-50 border border-rose-150/40 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/35'
                  : 'bg-purple-50 border border-purple-150/40 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/35'
              }`}
            >
              {localType}
            </button>
            <label htmlFor="exercise" className="block text-sm font-bold text-gray-700 dark:text-slate-300">Name</label>
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-medium ml-1 animate-pulse">(long press tag to switch)</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                id="exercise"
                type="text"
                required
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="w-full px-5 py-3.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-lg font-medium text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
                placeholder="e.g. Bench Press"
              />
            </div>
            {initialExercise && initialExercise !== '__NEW_MACHINE__' && exercise.trim() !== '' && exercise.trim().toLowerCase() !== initialExercise.toLowerCase() && (
              <button
                type="button"
                onClick={async () => {
                  const cleanedName = exercise.trim();
                  if (!cleanedName) return;
                  if (saveMachineConfig) {
                    const existing = machineConfigs.find(c => c.exercise.toLowerCase() === initialExercise.toLowerCase());
                    const baseLbs = existing?.baseWeightLbs || 0;
                    const baseKg = existing?.baseWeightKg || 0;
                    const brand = existing?.brand || 'Standard';
                    const category = existing?.category || 'Custom';
                    const variantCategories = existing?.variantCategories || {};
                    try {
                      setIsSubmitting(true);
                      await saveMachineConfig(
                        cleanedName,
                        baseLbs,
                        baseKg,
                        brand,
                        category,
                        variantCategories,
                        localType,
                        initialExercise
                      );
                      if (onExerciseRename) {
                        onExerciseRename(cleanedName);
                      }
                    } catch (error) {
                      console.error("Failed to save name from AddWorkoutForm:", error);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                disabled={isSubmitting}
                className="shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm py-3.5 px-4 rounded-2xl shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 animate-in fade-in slide-in-from-right-3 duration-250"
              >
                <Check className="w-4 h-4 stroke-[3px]" />
                <span>Save Name</span>
              </button>
            )}
          </div>
          {initialExercise && initialExercise !== '__NEW_MACHINE__' && exercise.trim() !== '' && exercise.trim().toLowerCase() !== initialExercise.toLowerCase() && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 ml-1 animate-in fade-in duration-200">
              ✨ Click "Save Name" to rename this exercise and update all previous logs to match!
            </p>
          )}
        </div>

        {/* Mode Selection Section */}
        {exercise && (
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-300">
                Training Focus Mode
              </label>
              <div className="flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Grounded</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(['Volume', 'Strength', 'Speed', 'Endurance'] as const).map((m) => {
                const isActive = workoutMode === m;
                const getModeIcon = () => {
                  if (m === 'Volume') return <Dumbbell className="w-4 h-4" />;
                  if (m === 'Strength') return <TrendingUp className="w-4 h-4" />;
                  if (m === 'Speed') return <Zap className="w-4 h-4" />;
                  return <Clock className="w-4 h-4" />;
                };
                
                const getModeStyles = () => {
                  if (m === 'Volume') {
                    return isActive 
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 ring-2 ring-sky-500/20' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-sky-200 hover:bg-sky-50/20';
                  }
                  if (m === 'Strength') {
                    return isActive 
                      ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ring-2 ring-rose-500/20' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-rose-200 hover:bg-rose-50/20';
                  }
                  if (m === 'Speed') {
                    return isActive 
                      ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 ring-2 ring-amber-500/20' 
                      : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-amber-200 hover:bg-amber-50/20';
                  }
                  // Endurance
                  return isActive 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20' 
                    : 'border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:border-emerald-200 hover:bg-emerald-50/20';
                };
                
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeClick(m)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-2xl border text-xs font-bold transition-all duration-200 active:scale-95 shadow-sm cursor-pointer ${getModeStyles()}`}
                  >
                    {getModeIcon()}
                    <span>{m}</span>
                  </button>
                );
              })}
            </div>

            {/* AI Recommendation Panel */}
            <AnimatePresence mode="wait">
              {workoutMode && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="relative overflow-hidden p-5 bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950 dark:to-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-inner mt-2.5 space-y-4"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 dark:sky-400/5 rounded-full blur-2xl pointer-events-none" />
                  
                  {loadingRecommendation ? (
                    <div className="py-6 flex flex-col items-center justify-center space-y-3">
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <div className="absolute inset-0 border-2 border-sky-500/20 rounded-full" />
                        <div className="absolute inset-0 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                        <Sparkles className="w-4.5 h-4.5 text-sky-500 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-700 dark:text-slate-300">Analyzing training history...</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Optimizing neuromuscular recruitment</p>
                      </div>
                    </div>
                  ) : recommendationError ? (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-rose-700 dark:text-rose-400 text-xs">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Recommendation unavailable</p>
                        <p className="text-[10px] text-rose-650 dark:text-rose-400/85 mt-0.5">{recommendationError}</p>
                      </div>
                    </div>
                  ) : aiRecommendation ? (
                    <div className="space-y-4 animate-in fade-in duration-350">
                      {/* Header info */}
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300">
                              {workoutMode} Mode
                            </span>
                            {aiRecommendation.isFallback && (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                Kinematic Fallback
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                              Target: {aiRecommendation.fiberType}
                            </span>
                            {machineSets.length > 0 ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                                {machineSets.length} {machineSets.length === 1 ? 'série analysée' : 'séries analysées'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                Charge étalon initiale
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-medium text-gray-650 dark:text-slate-350 mt-2 leading-relaxed">
                            {aiRecommendation.reasoning}
                          </p>
                        </div>
                      </div>

                      {/* The Prescribed Workout Recommendation */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tight">Sets</span>
                          <span className="text-xl font-extrabold text-black dark:text-white mt-1">
                            {aiRecommendation.recommendedSets}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tight">Reps</span>
                          <span className="text-xl font-extrabold text-black dark:text-white mt-1">
                            {aiRecommendation.recommendedReps}
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tight">Target Weight</span>
                          <span className="text-base font-extrabold text-black dark:text-white mt-1">
                            {unit === 'lbs' 
                              ? `${Math.round(aiRecommendation.weightAdjustment.lbsValue)} lbs`
                              : `${Math.round(aiRecommendation.weightAdjustment.kgValue)} kg`
                            }
                          </span>
                          <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">
                            {unit === 'lbs'
                              ? `${Math.round(aiRecommendation.weightAdjustment.kgValue)} kg`
                              : `${Math.round(aiRecommendation.weightAdjustment.lbsValue)} lbs`
                            }
                          </span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 rounded-xl shadow-sm">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-tight">Rest Timer</span>
                          <span className="text-base font-extrabold text-sky-600 dark:text-sky-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {aiRecommendation.recommendedRestSeconds || restSeconds}s
                          </span>
                          <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">
                            {workoutMode} Mode
                          </span>
                        </div>
                      </div>

                      {/* Recommendation Explanation & Action Link */}
                      <div className="p-3 bg-white/60 dark:bg-slate-900/30 border border-gray-100/50 dark:border-slate-800/50 rounded-xl space-y-2">
                        <p className="text-[10.5px] font-medium text-gray-500 dark:text-slate-400 leading-normal">
                          <span className="font-bold text-black dark:text-white">Prescription: </span>
                          {aiRecommendation.weightAdjustment.explanation}
                        </p>
                        
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100/80 dark:border-slate-800/60 mt-2">
                          {(() => {
                            const localKey = typeof window !== 'undefined' ? window.localStorage.getItem("custom_gemini_api_key") : null;
                            const isUserPremium = !!dbUser?.isPremium || !!localKey;
                            const currentUses = dbUser?.premiumUses ?? 0;
                            const remaining = Math.max(0, 5 - currentUses);

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (workoutMode) {
                                    fetchOrLoadAiRecommendation(workoutMode, true);
                                  }
                                }}
                                disabled={loadingRecommendation}
                                className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                                title={
                                  isUserPremium 
                                    ? "Recalculate AI prescription (Unlimited Premium)" 
                                    : `Recalculate AI prescription (${remaining} of 5 credits remaining)`
                                }
                              >
                                <RefreshCw className={`w-3 h-3 ${loadingRecommendation ? 'animate-spin text-sky-500' : ''}`} />
                                <span>Refresh AI Recs</span>
                                {!isUserPremium && (
                                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full border ${
                                    remaining > 0 
                                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' 
                                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                  }`}>
                                    {remaining}/5 credits
                                  </span>
                                )}
                              </button>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => {
                              setReps(String(aiRecommendation.recommendedReps.split('-')[0] || aiRecommendation.recommendedReps));
                              const recommendedWeight = unit === 'lbs' 
                                ? aiRecommendation.weightAdjustment.lbsValue 
                                : aiRecommendation.weightAdjustment.kgValue;
                              setWeight(String(Math.round(recommendedWeight)));
                            }}
                            className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 hover:text-sky-750 dark:hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Apply recommended params →
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div>
          <label htmlFor="variant" className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
            Exercise Option / Variant <span className="text-gray-400 dark:text-slate-500 font-normal">(Optional)</span>
          </label>
          <input
            id="variant"
            type="text"
            value={variant || ''}
            onChange={(e) => setVariant(e.target.value)}
            className="w-full px-5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-base font-medium text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
            placeholder="e.g. Left axis, right rotation, chest fly, rear delt"
          />
          {existingVariants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-1">
              <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 mr-1">Suggestions:</span>
              {existingVariants.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                    variant.toLowerCase() === v.toLowerCase()
                      ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                      : 'border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-450 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="posture" className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
              Posture <span className="text-gray-400 dark:text-slate-500 font-normal">(Optional)</span>
            </label>
            {activeConfig?.postures && activeConfig.postures.length > 0 ? (
              <Dropdown
                value={posture}
                onChange={(val) => {
                  if (val === '__NEW_POSTURE__') {
                    setPosture('');
                    setWeightModifier('100');
                  } else {
                    setPosture(val);
                    const selectedP = activeConfig.postures?.find(p => p.name === val);
                    if (selectedP) setWeightModifier(String(selectedP.weightModifier));
                  }
                }}
                options={[
                  ...activeConfig.postures.map(p => ({ label: p.name, value: p.name })),
                  { label: '+ Add New Posture', value: '__NEW_POSTURE__' }
                ]}
                placeholder={posture || "Select posture"}
              />
            ) : (
              <div>
                <input
                  id="posture"
                  type="text"
                  value={posture || ''}
                  onChange={(e) => setPosture(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl text-base font-medium text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500"
                  placeholder="e.g. Kneeled, Inclined"
                />
                
                {exercise?.toLowerCase() === 'push up' && (
                  <div className="flex flex-col gap-1.5 mt-2 ml-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500 mr-1">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setPosture('Normal')}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                          posture.toLowerCase() === 'normal'
                            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-450 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosture('Kneeled')}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                          posture.toLowerCase() === 'kneeled'
                            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                            : 'border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-450 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Kneeled
                      </button>
                    </div>
                    {pushUpPercentage !== null && (
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Effective weight: {pushUpPercentage}% of body weight
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="weightModifier" className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
              Effective Weight %
            </label>
            <div className="flex items-stretch relative h-[52px]">
              <input
                id="weightModifier"
                type="number"
                min="0"
                max="200"
                value={weightModifier || ''}
                onChange={(e) => setWeightModifier(e.target.value)}
                className="flex-1 w-full pl-4 pr-1 h-full py-0 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 border-r-0 rounded-l-2xl text-base font-medium text-black dark:text-white focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white outline-none z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="100"
              />
              <div className="flex items-center justify-center px-4 bg-gray-200 dark:bg-slate-700 border-y border-r border-gray-200 dark:border-slate-800 rounded-r-2xl text-gray-600 dark:text-slate-300 text-base font-bold whitespace-nowrap min-w-[50px] shadow-sm z-20">
                %
              </div>
            </div>
          </div>
          
          {posture && (!activeConfig?.postures?.find(p => p.name === posture)) && (
            <div className="col-span-2 flex justify-end -mt-2 mb-2">
              <button
                type="button"
                onClick={async () => {
                  if (!exercise || !posture || !saveMachineConfig) return;
                  const existing = machineConfigs.find(c => c.exercise.toLowerCase() === exercise.toLowerCase());
                  const baseLbs = existing?.baseWeightLbs || 0;
                  const baseKg = existing?.baseWeightKg || 0;
                  const brand = existing?.brand || 'Standard';
                  const category = existing?.category || 'Custom';
                  const variantCategories = existing?.variantCategories || {};
                  
                  const modifiersList = existing?.postures ? [...existing.postures] : [];
                  modifiersList.push({
                    name: posture,
                    weightModifier: parseFloat(weightModifier) || 100
                  });
                  
                  try {
                     await saveMachineConfig(
                      exercise, baseLbs, baseKg, brand, category, variantCategories,
                      localType, undefined, undefined, undefined, undefined, undefined, undefined,
                      modifiersList
                    );
                  } catch (err) {
                    console.error("Failed to save posture combo:", err);
                  }
                }}
                className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 transition"
              >
                + Save Posture / % combo
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1fr_135px] sm:grid-cols-[1fr_150px] gap-3">
          <div>
            <label htmlFor="weight" className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">Weight</label>
            <div className="flex items-stretch relative h-[56px] z-30">
              <input
                id="weight"
                type="number"
                step="0.1"
                required
                value={weight || ''}
                onChange={(e) => setWeight(e.target.value)}
                className="flex-1 w-full pl-3.5 pr-1 h-full py-0 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 border-r-0 rounded-l-2xl text-lg font-medium text-black dark:text-white focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white outline-none z-10 placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-[75px]"
                placeholder="0"
              />
              <div className="w-[82px] sm:w-[95px] shrink-0 flex h-full">
                <Dropdown
                  className="h-full z-20"
                  value={unit}
                  onChange={(val) => handleUnitChange(val as 'lbs' | 'kg')}
                  options={[
                    { value: 'lbs', label: 'lbs' },
                    { value: 'kg', label: 'kg' }
                  ]}
                  buttonClassName="w-full h-full flex items-center justify-between bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-r-2xl px-2.5 sm:px-3 h-full py-0 text-sm font-bold text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                  menuClassName="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 py-1.5 focus:outline-none right-0 min-w-[110px]"
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="reps" className="block text-sm font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">Reps</label>
            <RepsInput
              id="reps"
              value={reps || ''}
              onChange={(val) => setReps(val)}
            />
          </div>
        </div>

        {/* Machine Baseline Calculator Info */}
        {parseFloat(activeBaseWeight) > 0 && (
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/30 rounded-2xl p-4 text-emerald-800 dark:text-emerald-300 space-y-1.5 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span>Dynamic Lift Weight Tracker</span>
              <span>Enabled</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap text-sm md:text-base">
              <span className="font-bold text-gray-900 dark:text-white bg-white/60 dark:bg-white/5 py-0.5 px-2 rounded">
                {invertWeight ? '-' : ''}{weight || '0'} {unit}
              </span>
              <span className="text-emerald-600 dark:text-emerald-500 font-bold">
                {invertBaseWeight ? '-' : '+'}
              </span>
              <span className="font-medium text-gray-600 dark:text-slate-400">
                {activeBaseWeight} {unit} <span className="text-[10px] opacity-80">({localType === 'Exercise' ? 'body weight' : localType === 'Weightlifting' ? 'bar/dumbbell weight' : 'machine carriage/axis'})</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-500 font-bold">=</span>
              {weightModifier !== '' && parseFloat(weightModifier) !== 100 && (
                <>
                  <span className="text-gray-400 dark:text-slate-500 font-bold mx-0.5">×</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded text-xs">{weightModifier}%</span>
                  <span className="text-emerald-600 dark:text-emerald-500 font-bold">=</span>
                </>
              )}
              <span className="font-black text-black dark:text-white text-base md:text-lg animate-none font-mono">
                {roundToTwo((((invertWeight ? -1 : 1) * (parseFloat(weight) || 0)) + ((invertBaseWeight ? -1 : 1) * (parseFloat(activeBaseWeight) || 0))) * (weightModifier !== '' ? (parseFloat(weightModifier) || 100) / 100 : 1))} {unit}
              </span>
              <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-slate-500 ml-auto font-sans">Total Weight</span>
            </div>
          </div>
        )}

        {/* Machine Basic Weight Config Input */}
        {exercise && (
          <div className="bg-gray-50 dark:bg-slate-900/40 p-4 border border-gray-100 dark:border-slate-800/80 rounded-2xl space-y-3.5 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide">
                {localType === 'Exercise' ? 'Body Weight' : localType === 'Weightlifting' ? 'Default Bar/Dumbbell Weight' : 'Machine Default Weight (Axis/Bar/Bodyweight)'}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">Auto-Saves</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex w-full max-w-[170px] h-[40px] shadow-sm shrink-0 relative items-stretch">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={activeBaseWeight}
                  onChange={(e) => setManualBaseWeight(e.target.value)}
                  className="w-full h-full px-3 py-0 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 border-r-0 rounded-l-xl text-sm font-bold text-black dark:text-white outline-none min-w-[90px] focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0.0"
                />
                <div className="w-[80px] shrink-0 h-full flex mt-0">
                  <Dropdown
                    className="h-full z-20"
                    value={unit}
                    onChange={(val) => handleUnitChange(val as 'lbs' | 'kg')}
                    options={[
                      { value: 'lbs', label: 'LBS' },
                      { value: 'kg', label: 'KG' }
                    ]}
                    buttonClassName="w-full h-full flex items-center justify-between bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-r-xl px-3 py-0 text-[11px] font-extrabold text-gray-500 dark:text-slate-400 focus:outline-none focus:ring-inset focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                    menuClassName="absolute z-50 w-[100px] mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 py-1.5 focus:outline-none right-0"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug font-sans">
                {localType === 'Exercise' 
                  ? 'Set baseline body weight so it is added automatically for total relative output tracking.'
                  : localType === 'Weightlifting'
                  ? 'Set baseline weight of the bar or dumbbell handle so it automatically adds to plate/added weight.'
                  : 'Set baseline weight of the axis/carriage (e.g., 45 lbs bar weight) so it automatically adds to plate weight.'}
              </p>
            </div>
          </div>
        )}

        {/* Collapsible Optional & Custom Adjustment Fields section */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowOptionalFields(!showOptionalFields)}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer select-none py-1 ml-1"
          >
            {showOptionalFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showOptionalFields ? 'Hide Optional Tracking Specs' : 'Show Optional Tracking Specs...'}</span>
          </button>

          {showOptionalFields && (
            <div className="mt-3.5 space-y-4 bg-gray-50/50 dark:bg-slate-900/20 p-4 border border-gray-100 dark:border-slate-800/60 rounded-2xl animate-in slide-in-from-top-3 duration-200">
              
              {/* Optional Field: Degrees */}
              <div>
                <label htmlFor="degrees" className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                  Degrees Option
                </label>
                <DegreeWheelPicker
                  id="degrees"
                  value={degrees}
                  onChange={(val) => setDegrees(val)}
                  exerciseName={exercise}
                />
              </div>

              {/* Optional Field: Date & Hour for Antedating ("Antédater") */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1 flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-400 dark:text-slate-500" />
                  Date & Hour <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">(Antédater / Backdate if needed)</span>
                </label>
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 outline-none cursor-pointer"
                />
              </div>

              {/* Dynamic Optional Fields Configured for this machine */}
              {activeConfig?.customFields && activeConfig.customFields.length > 0 && (
                <div className="space-y-3.5 pt-3.5 border-t border-gray-200 dark:border-slate-800">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                    Gear Adjustment Specs
                  </h5>
                  <div className="grid grid-cols-1 gap-3">
                    {activeConfig.customFields.map((field: string) => (
                      <div key={field}>
                        <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 ml-1">
                          {field} <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal">(Optional spec info)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 3, Back, Low..."
                          value={customFieldsValues[field] || ''}
                          onChange={(e) => setCustomFieldsValues(prev => ({ ...prev, [field]: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-black dark:focus:ring-white outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Machine-Wide Settings: Weight Inverter */}
              <div className="space-y-3.5 pt-3.5 border-t border-gray-200 dark:border-slate-800">
                <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                  Machine Settings (Applied Globally)
                </h5>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={invertWeight} 
                      onChange={(e) => setInvertWeight(e.target.checked)}
                      className="w-4 h-4 rounded text-black focus:ring-black"
                    />
                    Invert Plate/Load Weight (Negative pull)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 dark:text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={invertBaseWeight} 
                      onChange={(e) => setInvertBaseWeight(e.target.checked)}
                      className="w-4 h-4 rounded text-black focus:ring-black"
                    />
                    Invert Base Weight (e.g. Chin Assist)
                  </label>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {workoutMode && (
        <div className="flex items-center justify-between text-xs font-semibold px-3.5 py-2 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl text-sky-800 dark:text-sky-300 shadow-sm mt-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-500 fill-sky-500" />
            <span>{workoutMode} Mode Active (Persistent)</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            <Clock className="w-3 h-3" />
            <span>Rest: {restSeconds}s</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 items-stretch mt-3">
        <button
          type="submit"
          disabled={isSubmitting || !exercise}
          className="relative overflow-hidden flex-1 py-4 px-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-lg font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-200 dark:shadow-none active:scale-[0.98]"
        >
          {restTimerInfo.isResting && (
             <div 
               className="absolute inset-0 pointer-events-none rounded-2xl" 
               style={{ 
                 padding: '3px', 
                 background: `conic-gradient(from 0deg, ${fillHexColor} ${restTimerInfo.progress}%, ${isDark ? '#334155' : '#e2e8f0'} 0%)` 
               }}
             >
                <div className="h-full w-full bg-black dark:bg-white rounded-[13px]" />
             </div>
          )}
          <span className="z-10 relative">
            {isSubmitting ? 'Saving...' : 'Add Set'}
          </span>
        </button>

        {exercise && (
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setIsHistoryMode(!isHistoryMode);
                setSelectedSetToEditId(null);
              }}
              className="p-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-705 text-gray-750 dark:text-slate-300 rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center h-full aspect-square"
              title="Edit Set History"
            >
              <History size={24} />
            </button>
          </div>
        )}
      </div>

      {/* Premium Upgrade Prompt Modal */}
      <AnimatePresence>
        {showPremiumUpgradeModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPremiumUpgradeModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 text-center space-y-5 overflow-hidden"
            >
              {/* Decorative top accent */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />
              
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center">
                <Zap size={24} className="fill-amber-500" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Weekly 5 AI Credits Reached</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  You have used your <span className="font-bold text-gray-900 dark:text-white">5 free weekly credits</span> for AI coaching and workout prescriptions.
                </p>
              </div>

              {/* Reset Timer Banner */}
              {(() => {
                const countdown = getCreditResetCountdown(dbUser?.premiumUsesResetAt);
                return (
                  <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 p-3.5 rounded-2xl flex items-center justify-between text-left">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-sky-800 dark:text-sky-300 block">Weekly Credit Reset</span>
                        <span className="text-xs font-medium text-sky-700 dark:text-sky-400">5 credits renew automatically</span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-sky-900 dark:text-sky-200 bg-white dark:bg-sky-900/80 px-2.5 py-1 rounded-xl shadow-2xs border border-sky-100 dark:border-sky-800 shrink-0">
                      In {countdown.formatted}
                    </span>
                  </div>
                );
              })()}

              <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3 text-left">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 font-mono">Want Unlimited AI Features?</h4>
                <ul className="space-y-2 text-[11px] text-gray-600 dark:text-slate-300 font-semibold">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Unlimited AI Biomechanical Coaching Recs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Unlimited Gemini Muscle Scanners & Load Recs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Or add your custom Gemini API key for free
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPremiumUpgradeModal(false);
                    if (onNavigateToTab) {
                      onNavigateToTab('user');
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} />
                  <span>Upgrade to Premium Access</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPremiumUpgradeModal(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Maybe Later (Wait for Reset)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Missing Alert Modal */}
      <AnimatePresence>
        {showApiKeyMissingModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyMissingModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-slate-800 text-center space-y-6 overflow-hidden"
            >
              {/* Decorative top accent */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-red-500" />
              
              <div className="mx-auto w-12 h-12 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center">
                <AlertTriangle size={24} />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">API Configuration Required</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  The server is missing a valid Gemini API Key, or your custom key is invalid. 
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  Since you are Premium, you can enter a free Gemini API Key to bypass this and run unlimited scans instantly!
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowApiKeyMissingModal(false);
                    if (onNavigateToTab) {
                      onNavigateToTab('user');
                    }
                  }}
                  className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-bold text-sm rounded-2xl shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Settings size={16} />
                  <span>Configure API Key in Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiKeyMissingModal(false)}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-gray-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </form>
  );
}
