import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { WorkoutSet, MachineConfig } from '../types';
import { calculateFatigueScores } from '../utils/fatigue';
import { Plus, Search, Building2, Filter, Pencil, Cpu, Dumbbell, Clock, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import Dropdown from './Dropdown';

export const MACHINES = [
  { name: 'Arm Curl', category: 'Arms', restSeconds: 90, type: 'Machine' },
  { name: 'Abdominal', category: 'Core', restSeconds: 90, type: 'Machine' },
  { name: 'Pec fly', category: 'Chest', restSeconds: 120, type: 'Machine' },
  { name: 'Rotary Torso', category: 'Core', restSeconds: 90, type: 'Machine' },
  { name: 'Perfect Squat', category: 'Legs', restSeconds: 180, type: 'Machine' },
  { name: 'Glute Trainer', category: 'Legs', restSeconds: 150, type: 'Machine' },
  { name: 'Dumbbell Curl', category: 'Arms', restSeconds: 90, type: 'Exercise' },
  { name: 'Barbell Bench Press', category: 'Chest', restSeconds: 150, type: 'Exercise' },
  { name: 'Barbell Squat', category: 'Legs', restSeconds: 180, type: 'Exercise' },
  { name: 'Pull-up', category: 'Back', restSeconds: 120, type: 'Exercise' },
  { name: 'Lateral Raise', category: 'Shoulders', restSeconds: 90, type: 'Exercise' },
  { name: 'Plank', category: 'Core', restSeconds: 60, type: 'Exercise' },
];

const getSetTime = (s: any): number => {
  const d = s.date || s.createdAt;
  if (!d) return Date.now();
  if (d.toMillis) return d.toMillis();
  if (d.toDate) return d.toDate().getTime();
  if (d.seconds) return d.seconds * 1000;
  return new Date(d).getTime();
};

export default function MachineList({ 
  onMachineSelect, 
  onMachineEdit,
  isEditMode = false,
  sets, 
  machineConfigs = [],
  initialCategoryFilter = 'All',
  saveMachineConfig,
  onCategoryTagClick
}: { 
  onMachineSelect: (name: string, variant?: string) => void; 
  onMachineEdit?: (name: string) => void;
  isEditMode?: boolean;
  sets: WorkoutSet[]; 
  machineConfigs?: MachineConfig[];
  initialCategoryFilter?: string;
  onCategoryTagClick?: (category: string, exerciseName?: string) => void;
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
    invertBaseWeight?: boolean
  ) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  
  const cardTagPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isCardTagLongPressed = useRef(false);

  const cardLongPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardHasLongPressedRef = useRef(false);

  const startCardTagPress = (m: any, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isCardTagLongPressed.current = false;
    cardTagPressTimer.current = setTimeout(async () => {
      isCardTagLongPressed.current = true;
      let newType: 'Machine' | 'Weightlifting' | 'Exercise' = 'Machine';
      if (m.type === 'Machine') {
        newType = 'Weightlifting';
      } else if (m.type === 'Weightlifting') {
        newType = 'Exercise';
      } else {
        newType = 'Machine';
      }
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      if (saveMachineConfig) {
        try {
          await saveMachineConfig(
            m.name,
            m.config?.baseWeightLbs || 0,
            m.config?.baseWeightKg || 0,
            m.brand,
            m.category,
            m.config?.variantCategories,
            newType
          );
        } catch (error) {
          console.error("Failed to swap type via card long-press:", error);
        }
      }
    }, 600);
  };

  const endCardTagPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (cardTagPressTimer.current) {
      clearTimeout(cardTagPressTimer.current);
    }
  };

  const handleCardTagClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  // Grouping and Filtering states
  const [groupBy, setGroupBy] = useState<'none' | 'category' | 'brand'>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>(initialCategoryFilter || 'All');
  const [selectedFilterBrand, setSelectedFilterBrand] = useState<string>('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'All' | 'Machine' | 'Weightlifting' | 'Exercise'>('All');
  const [sortByLastUsed, setSortByLastUsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('sortByLastUsed');
    return saved === 'true';
  });

  const [sortByFatigue, setSortByFatigue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('sortByFatigue');
    return saved === 'true';
  });

  const [recentCardsCount, setRecentCardsCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 5;
    const saved = window.localStorage.getItem('recentCardsCount');
    return saved ? Number(saved) : 5;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sortByLastUsed', String(sortByLastUsed));
    }
  }, [sortByLastUsed]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sortByFatigue', String(sortByFatigue));
    }
  }, [sortByFatigue]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('recentCardsCount', String(recentCardsCount));
    }
  }, [recentCardsCount]);

  // Sync state if initial category changes externally (e.g. clicking "view chest machines" in avatar)
  useEffect(() => {
    if (initialCategoryFilter) {
      setSelectedFilterCategory(initialCategoryFilter);
    }
  }, [initialCategoryFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const userMachines = useMemo(() => {
    const defaultMachineNames = MACHINES.map(m => m.name);
    const customNamesFromSets = sets.map(s => s.exercise);
    const customNamesFromConfigs = machineConfigs.map(c => c.exercise);
    
    const customNames = Array.from(new Set([...customNamesFromSets, ...customNamesFromConfigs])).filter(name => !defaultMachineNames.includes(name) && name.trim() !== '');

    return customNames.map(name => {
      // Pick dynamic default category from machineConfigs if it exists
      const config = machineConfigs.find(c => c.exercise.toLowerCase() === name.toLowerCase());
      return {
        name,
        category: config?.category || 'Custom',
        restSeconds: 120, // default rest time for custom machines
        type: config?.type || 'Machine'
      };
    });
  }, [sets, machineConfigs]);

  const allMachines = useMemo(() => {
    const renamedDefaultNames = new Set(
      machineConfigs
        .map(c => c.originalName?.toLowerCase())
        .filter(Boolean) as string[]
    );
    const activeDefaults = MACHINES.filter(m => !renamedDefaultNames.has(m.name.toLowerCase()));
    return [...activeDefaults, ...userMachines];
  }, [userMachines, machineConfigs]);

  // Merge machines with Firestore machineConfigs to fetch brand and category overrides
  const machinesWithMetadata = useMemo(() => {
    return allMachines.map(m => {
      const config = machineConfigs.find(c => c.exercise.toLowerCase() === m.name.toLowerCase());
      return {
        ...m,
        category: config?.category || m.category || 'Custom',
        brand: config?.brand || 'Standard',
        type: config?.type || (m as any).type || 'Machine',
        config
      };
    });
  }, [allMachines, machineConfigs]);

  const lastUsedTimestamps = useMemo(() => {
    const mapping: Record<string, number> = {};
    sets.forEach(s => {
      if (!s.exercise) return;
      const exerciseKey = s.exercise.toLowerCase();
      const time = getSetTime(s);
      if (!mapping[exerciseKey] || time > mapping[exerciseKey]) {
        mapping[exerciseKey] = time;
      }
    });
    return mapping;
  }, [sets]);

  const lastUsedMachines = useMemo(() => {
    if (!sets || sets.length === 0) return [];
    
    // Group sets by exercise name and get the max timestamp
    const latestSetByExercise: Record<string, number> = {};
    sets.forEach(s => {
      if (!s.exercise) return;
      const key = s.exercise.toLowerCase();
      const time = getSetTime(s);
      if (!latestSetByExercise[key] || time > latestSetByExercise[key]) {
        latestSetByExercise[key] = time;
      }
    });

    // Sort exercises based on latest use timestamp
    const sortedExercises = Object.keys(latestSetByExercise).sort((a, b) => {
      return latestSetByExercise[b] - latestSetByExercise[a];
    });

    // Find unique machines from machinesWithMetadata ordered by last used timestamp up to max recent limit
    const maxRecent = Math.max(recentCardsCount, 15);
    const result: typeof machinesWithMetadata = [];
    for (const exKey of sortedExercises) {
      const match = machinesWithMetadata.find(m => m.name.toLowerCase() === exKey);
      if (match && !result.some(r => r.name.toLowerCase() === match.name.toLowerCase())) {
        result.push(match);
      }
      if (result.length >= maxRecent) {
        break;
      }
    }
    return result;
  }, [sets, machinesWithMetadata, recentCardsCount]);

  const displayedRecentMachines = useMemo(() => {
    return lastUsedMachines.slice(0, recentCardsCount);
  }, [lastUsedMachines, recentCardsCount]);

  // Unique list of categories and brands for the select elements
  const categories = useMemo(() => {
    const list = machinesWithMetadata.map(m => m.category);
    return ['All', ...Array.from(new Set(list))];
  }, [machinesWithMetadata]);

  const brands = useMemo(() => {
    const list = machinesWithMetadata.map(m => m.brand);
    return ['All', ...Array.from(new Set(list))];
  }, [machinesWithMetadata]);

  const globalFatigueScores = useMemo(() => {
    return calculateFatigueScores(sets, machineConfigs);
  }, [sets, machineConfigs]);

  const getMachineFatigueScore = useCallback((m: any): number => {
    if (m.config && m.config.linkedMuscles && m.config.linkedMuscles.length > 0) {
      let maxF = 0;
      m.config.linkedMuscles.forEach((mid: string) => {
        if ((globalFatigueScores[mid] || 0) > maxF) maxF = globalFatigueScores[mid] || 0;
      });
      return maxF;
    } else if (m.config && m.config.linkedGroups && m.config.linkedGroups.length > 0) {
      let maxF = 0;
      m.config.linkedGroups.forEach((g: string) => {
        if ((globalFatigueScores[g] || 0) > maxF) maxF = globalFatigueScores[g] || 0;
      });
      return maxF;
    } else if (m.category && m.category !== 'Custom') {
      return globalFatigueScores[m.category] || 0;
    } else {
      // Fallback for custom machines with no links
      const fatigueWindowMs = 168 * 3600 * 1000;
      const recentCount = sets.filter(s => {
        if (!s.exercise || s.exercise.toLowerCase() !== (m.name || '').toLowerCase()) return false;
        const time = getSetTime(s);
        return (now - time) < fatigueWindowMs;
      }).length;
      if (recentCount > 4) return 0.8;
      if (recentCount > 2) return 0.5;
      if (recentCount > 0) return 0.2;
      return 0;
    }
  }, [globalFatigueScores, sets, now]);

  // Filter and sort based on search query, category path, brand path, equipment type, and sort option
  const filteredMachines = useMemo(() => {
    const list = machinesWithMetadata.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            m.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedFilterCategory === 'All' || m.category === selectedFilterCategory;
      const matchesBrand = selectedFilterBrand === 'All' || m.brand === selectedFilterBrand;
      const matchesType = selectedTypeFilter === 'All' || m.type === selectedTypeFilter;
      return matchesSearch && matchesCategory && matchesBrand && matchesType;
    });

    const getTypeOrder = (type?: string) => {
      if (type === 'Machine') return 1;
      if (type === 'Weightlifting') return 2;
      if (type === 'Exercise') return 3;
      return 4;
    };

    return list.sort((a, b) => {
      // Primary: Sort by Fatigue (Ascending: less fatigued / freshest first)
      if (sortByFatigue) {
        const fatigueA = getMachineFatigueScore(a);
        const fatigueB = getMachineFatigueScore(b);
        if (Math.abs(fatigueA - fatigueB) > 0.001) {
          return fatigueA - fatigueB;
        }
      }

      // Secondary: Sort by Last Used (Descending: most recent first)
      if (sortByLastUsed) {
        const timeA = lastUsedTimestamps[a.name.toLowerCase()] || 0;
        const timeB = lastUsedTimestamps[b.name.toLowerCase()] || 0;
        if (timeA !== timeB) {
          return timeB - timeA;
        }
      }

      const orderA = getTypeOrder(a.type);
      const orderB = getTypeOrder(b.type);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [machinesWithMetadata, searchQuery, selectedFilterCategory, selectedFilterBrand, selectedTypeFilter, sortByFatigue, sortByLastUsed, lastUsedTimestamps, getMachineFatigueScore]);

  // Dynamic Grouping
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filteredMachines> = {};
    filteredMachines.forEach(m => {
      const cat = m.category || 'Custom';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });
    return groups;
  }, [filteredMachines]);

  const groupedByBrand = useMemo(() => {
    const groups: Record<string, typeof filteredMachines> = {};
    filteredMachines.forEach(m => {
      const b = m.brand || 'Standard';
      if (!groups[b]) groups[b] = [];
      groups[b].push(m);
    });
    return groups;
  }, [filteredMachines]);

  // Determine the least trained muscle group over the last 7 days to apply a glow
  const leastTrainedCategory = useMemo(() => {
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const categoryVolume: Record<string, number> = {};
    machinesWithMetadata.forEach(m => { categoryVolume[m.category] = 0; });

    sets.forEach(s => {
      const time = getSetTime(s);
      if (time > sevenDaysAgo) {
        const machine = machinesWithMetadata.find(m => m.name.toLowerCase() === s.exercise.toLowerCase());
        if (machine) {
          categoryVolume[machine.category] = (categoryVolume[machine.category] || 0) + 1;
        }
      }
    });

    let minCat = '';
    let minVol = Infinity;
    Object.entries(categoryVolume).forEach(([cat, vol]) => {
      if (vol < minVol && cat !== 'Custom') {
        minVol = vol;
        minCat = cat;
      }
    });
    return minCat || 'Custom';
  }, [sets, now, machinesWithMetadata]);

  // Render Card Component
  const renderMachineCard = (m: typeof machinesWithMetadata[0]) => {
    const machineSets = sets
      .filter(s => s.exercise.toLowerCase() === m.name.toLowerCase())
      .sort((a, b) => {
        const timeA = getSetTime(a);
        const timeB = getSetTime(b);
        return timeB - timeA;
      });

    const setsTodayCount = machineSets.filter(s => {
      const time = getSetTime(s);
      if (!time) return false;
      const setDate = new Date(time);
      const nowDate = new Date(now);
      return (
        setDate.getFullYear() === nowDate.getFullYear() &&
        setDate.getMonth() === nowDate.getMonth() &&
        setDate.getDate() === nowDate.getDate()
      );
    }).length;
    const setsTodayFormatted = String(setsTodayCount).padStart(2, '0');
      
    const lastSet = machineSets.length > 0 ? machineSets[0] : null;

    const machineFatigueScore = getMachineFatigueScore(m);

    let fillHexColor = '#000000'; 
    let fatigueColorClass = 'text-gray-900 dark:text-gray-100';
    let fatigueBgClass = 'bg-gray-100 dark:bg-slate-800';
    
    let defaultBorderColor = m.type === 'Exercise'
      ? 'border-purple-200 dark:border-purple-900/50 hover:border-purple-500 dark:hover:border-purple-400'
      : m.type === 'Weightlifting'
      ? 'border-rose-200 dark:border-rose-900/50 hover:border-rose-500 dark:hover:border-rose-400'
      : 'border-gray-100 dark:border-slate-800 hover:border-cyan-405 dark:hover:border-cyan-500';

    let borderColorClass = isEditMode 
      ? 'border-amber-400 dark:border-amber-400 hover:border-amber-500' 
      : defaultBorderColor;
    let fatigueLabel = '';
    
    if (machineFatigueScore > 0) {
      if (machineFatigueScore <= 0.3) {
        fillHexColor = '#4ade80'; // Green
        fatigueColorClass = 'text-green-700 dark:text-green-300';
        fatigueBgClass = 'bg-green-100 dark:bg-green-905/30';
        if (!isEditMode) borderColorClass = 'border-green-400';
        fatigueLabel = 'Mild Fatigue';
      } else if (machineFatigueScore <= 0.7) {
        fillHexColor = '#f59e0b'; // Amber
        fatigueColorClass = 'text-amber-700 dark:text-amber-300';
        fatigueBgClass = 'bg-amber-100 dark:bg-amber-905/30';
        if (!isEditMode) borderColorClass = 'border-amber-400';
        fatigueLabel = 'Mod. Fatigue';
      } else {
        fillHexColor = '#ef4444'; // Red
        fatigueColorClass = 'text-red-700 dark:text-red-300';
        fatigueBgClass = 'bg-red-100 dark:bg-red-905/30';
        if (!isEditMode) borderColorClass = 'border-red-400';
        fatigueLabel = 'Heavy Fatigue';
      }
    }

    let progress = 100;
    let isResting = false;
    let timeRemaining = 0;

    if (lastSet) {
      const lastSetTime = lastSet.createdAt ? lastSet.createdAt.toMillis() : lastSet.date.toMillis();
      const timeSinceLastSet = (now - lastSetTime) / 1000;
      if (timeSinceLastSet < m.restSeconds) {
        progress = (timeSinceLastSet / m.restSeconds) * 100;
        isResting = true;
        timeRemaining = Math.max(0, Math.ceil(m.restSeconds - timeSinceLastSet));
      }
    }

    const isLeastTrained = m.category === leastTrainedCategory;
    const glowClass = isLeastTrained ? 'shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'shadow-sm';

    const baseWeightLbs = m.config ? m.config.baseWeightLbs : 0;

    // Get unique options/variants logged for this machine
    const machineVariants = m.name 
      ? Array.from(new Set(
          sets
            .filter(s => s.exercise.toLowerCase() === m.name.toLowerCase() && s.variant)
            .map(s => s.variant!)
        )).filter(Boolean)
      : [];

    // Long press detector for card editing
    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.target as HTMLElement;
      // Skip interactive children: select, option, button, category pill, etc
      if (
        target.closest('button') || 
        target.closest('select') || 
        target.closest('option') || 
        target.closest('input') || 
        target.closest('span[role="button"]') ||
        target.closest('.cursor-pointer') && target !== e.currentTarget
      ) {
        return;
      }
      cardHasLongPressedRef.current = false;
      cardLongPressTimeoutRef.current = setTimeout(() => {
        cardHasLongPressedRef.current = true;
        if (onMachineEdit) {
          onMachineEdit(m.name);
        }
      }, 700);
    };

    const handlePressEnd = () => {
      if (cardLongPressTimeoutRef.current) {
        clearTimeout(cardLongPressTimeoutRef.current);
        cardLongPressTimeoutRef.current = null;
      }
    };

    const handleCardClick = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') {
        return;
      }
      if (cardHasLongPressedRef.current) {
        cardHasLongPressedRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isEditMode && onMachineEdit) {
        onMachineEdit(m.name);
      } else {
        onMachineSelect(m.name, selectedVariants[m.name] || '');
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isEditMode && onMachineEdit) {
          onMachineEdit(m.name);
        } else {
          onMachineSelect(m.name, selectedVariants[m.name] || '');
        }
      }
    };

    return (
      <div
        key={m.name}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        onMouseDown={handlePressStart}
        onTouchStart={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchEnd={handlePressEnd}
        onMouseLeave={handlePressEnd}
        className={`relative bg-white dark:bg-slate-900 p-5 pl-7 rounded-3xl transition-all text-left flex flex-col items-start gap-4 active:scale-95 overflow-hidden group min-h-[150px] cursor-pointer ${isResting ? 'border-transparent' : 'border border-2 ' + borderColorClass} ${glowClass}`}
      >
        {isResting && (
           <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{ padding: '4px', background: `conic-gradient(from 0deg, ${fillHexColor} ${progress}%, #f3f4f6 0%)` }}>
              <div className="h-full w-full bg-white dark:bg-slate-900 rounded-[20px]" />
           </div>
        )}

        {/* Lefthand high-fidelity indicator slice */}
        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${
          m.type === 'Exercise' 
            ? 'bg-gradient-to-b from-purple-500 to-indigo-600' 
            : m.type === 'Weightlifting'
            ? 'bg-gradient-to-b from-rose-500 to-amber-500'
            : 'bg-gradient-to-b from-cyan-400 to-sky-500'
        }`} />

        {/* Edit mode indicator */}
        {isEditMode && (
          <div className="absolute top-2.5 right-2.5 z-20 bg-amber-500 rounded-lg p-1 text-white shadow-sm animate-pulse">
            <Pencil size={11} className="stroke-[3px]" />
          </div>
        )}
        
        <div className="z-10 relative flex flex-col items-start gap-3 w-full h-full">
          <div className="flex justify-between w-full items-start gap-1">
            <div className="flex flex-wrap items-center gap-1">
              {/* Sets Realized Today Badge in Top Left aligned with muscular group */}
              <div
                title={`${setsTodayCount} set${setsTodayCount === 1 ? '' : 's'} realized today`}
                aria-label={`${setsTodayCount} set${setsTodayCount === 1 ? '' : 's'} realized today`}
                className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-mono tabular-nums font-extrabold tracking-tight transition-all duration-200 select-none shrink-0 ${
                  setsTodayCount > 0
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-400/50 dark:border-emerald-500/40 ring-1 ring-emerald-400/20'
                    : 'bg-gray-100/90 dark:bg-slate-800/90 text-gray-400 dark:text-slate-500 border-gray-200/60 dark:border-slate-700/60'
                }`}
              >
                <span className="text-[8.5px] font-sans font-bold uppercase text-gray-400 dark:text-slate-500 tracking-wider">SETS</span>
                <span>{setsTodayFormatted}</span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onCategoryTagClick) {
                    onCategoryTagClick(m.category, m.name);
                  }
                }}
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md transition-all duration-200 active:scale-90 hover:opacity-85 cursor-pointer border select-none ${
                  isLeastTrained 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-400/40 hover:border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.3)]' 
                    : 'bg-gray-150/80 dark:bg-slate-805 text-gray-600 dark:text-slate-400 border-gray-200/55 dark:border-slate-700/60 hover:border-slate-500/50 dark:hover:border-slate-500'
                }`}
                title={`Click to focus on ${m.category} in interactive muscle avatar`}
              >
                 {m.category}
              </button>
              {m.type === 'Machine' ? (
                <span
                  title="Long press to toggle"
                  onMouseDown={(e) => startCardTagPress(m, e)}
                  onTouchStart={(e) => startCardTagPress(m, e)}
                  onMouseUp={endCardTagPress}
                  onTouchEnd={endCardTagPress}
                  onMouseLeave={endCardTagPress}
                  onClick={handleCardTagClick}
                  className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 px-2 py-1 rounded-md shrink-0 flex items-center gap-1 border border-cyan-150/40 dark:border-cyan-900/35 animate-in fade-in duration-300 select-none cursor-pointer hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
                >
                  <Cpu size={9} /> Machine
                </span>
              ) : m.type === 'Weightlifting' ? (
                <span
                  title="Long press to toggle"
                  onMouseDown={(e) => startCardTagPress(m, e)}
                  onTouchStart={(e) => startCardTagPress(m, e)}
                  onMouseUp={endCardTagPress}
                  onTouchEnd={endCardTagPress}
                  onMouseLeave={endCardTagPress}
                  onClick={handleCardTagClick}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-1 rounded-md shrink-0 flex items-center gap-1 border border-rose-150/40 dark:border-rose-900/35 animate-in fade-in duration-300 select-none cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/50"
                >
                  <Dumbbell size={9} /> Weightlifting
                </span>
              ) : (
                <span
                  title="Long press to toggle"
                  onMouseDown={(e) => startCardTagPress(m, e)}
                  onTouchStart={(e) => startCardTagPress(m, e)}
                  onMouseUp={endCardTagPress}
                  onTouchEnd={endCardTagPress}
                  onMouseLeave={endCardTagPress}
                  onClick={handleCardTagClick}
                  className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-md shrink-0 flex items-center gap-1 border border-purple-150/40 dark:border-purple-900/35 animate-in fade-in duration-300 select-none cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/50"
                >
                  <Dumbbell size={9} /> Exercise
                </span>
              )}
              {m.brand && m.brand !== 'Standard' && (
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-1 rounded-md shrink-0 flex items-center gap-0.5">
                  <Building2 size={8} /> {m.brand}
                </span>
              )}
              {baseWeightLbs > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-1 rounded-md shrink-0">
                   +{baseWeightLbs} lbs {m.type === 'Exercise' ? 'body' : m.type === 'Weightlifting' ? 'bar' : 'axis'}
                </span>
              )}
              {sortByFatigue && (
                <span
                  title={`Recovery status: ${Math.round((1 - machineFatigueScore) * 100)}% recovered`}
                  className={`text-[10px] font-bold px-1.5 py-1 rounded-md shrink-0 flex items-center gap-1 border select-none ${
                    machineFatigueScore === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40'
                      : machineFatigueScore <= 0.3
                      ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200/50 dark:border-green-800/40'
                      : machineFatigueScore <= 0.7
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/50 dark:border-rose-800/40'
                  }`}
                >
                  <Zap size={9} className="fill-current" />
                  {machineFatigueScore === 0 ? '100% Fresh' : `${Math.round(machineFatigueScore * 100)}% Fatigued`}
                </span>
              )}
            </div>
            {isResting && (
              <span className={`text-[10px] font-bold animate-pulse px-2 py-1 rounded bg-black dark:bg-white text-white dark:text-black shrink-0 ${isEditMode ? 'mr-7' : ''}`}>
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            )}
          </div>
          
          <div className="mt-auto space-y-2 w-full">
            <span className="font-bold text-gray-900 dark:text-white text-lg leading-tight block">{m.name}</span>
            {m.config?.linkedMuscles && m.config.linkedMuscles.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5 pointer-events-none select-none">
                {m.config.linkedMuscles.map((muscle: string) => (
                  <span key={muscle} className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full border border-blue-100/30 dark:border-blue-900/20 uppercase tracking-tight">
                    💪 {muscle.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            {m.config?.customFields && m.config.customFields.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5 pointer-events-none select-none">
                {m.config.customFields.map((field: string) => (
                  <span key={field} className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md border border-amber-200/30 dark:border-slate-800 uppercase tracking-wider">
                    ⚙️ {field}
                  </span>
                ))}
              </div>
            )}
            {machineFatigueScore > 0 && !isEditMode && (
               <div className="space-y-1.5 w-full">
                 <div className="flex items-center justify-between gap-1 w-full">
                   <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm inline-block ${fatigueBgClass} ${fatigueColorClass}`}>
                      {fatigueLabel}
                   </span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                   <div 
                     className="h-full rounded-full transition-all duration-500 ease-out" 
                     style={{ 
                       width: `${Math.min(100, Math.max(0, machineFatigueScore * 100))}%`,
                       backgroundColor: fillHexColor 
                     }}
                   />
                 </div>
               </div>
            )}

            {/* Variant/Option Dropdown Selection */}
            {machineVariants.length > 0 && !isEditMode && (
              <div className="w-full pt-1.5" onClick={(e) => e.stopPropagation()}>
                <label className="block text-[9px] font-extrabold text-sky-600 dark:text-sky-400 mb-1 uppercase tracking-wider">
                  Option / Variant
                </label>
                <div className="w-full">
                  <Dropdown
                    value={selectedVariants[m.name] || ''}
                    onChange={(val) => {
                      setSelectedVariants(prev => ({ ...prev, [m.name]: val }));
                    }}
                    options={[
                      { value: '', label: 'Default/Standard' },
                      ...machineVariants.map(v => {
                        const variantMuscle = m.config?.variantCategories?.[v];
                        return { 
                          value: v, 
                          label: variantMuscle ? `${v} (${variantMuscle})` : v 
                        };
                      })
                    ]}
                    buttonClassName="w-full flex items-center justify-between text-xs font-bold py-1 px-1.5 bg-gray-55 dark:bg-slate-800 border border-gray-200 dark:border-slate-700/80 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAddMachineButton = () => {
    if (isEditMode) return null;
    return (
      <button
        onClick={() => onMachineSelect('__NEW_MACHINE__')}
        className="relative bg-gray-50 dark:bg-slate-900/50 p-5 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-black dark:hover:border-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex flex-col items-center justify-center gap-3 active:scale-95 min-h-[140px] group"
      >
        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm text-gray-400 dark:text-slate-500 group-hover:text-black dark:group-hover:text-white group-hover:bg-black dark:group-hover:bg-white transition-colors">
          <Plus size={20} strokeWidth={3} />
        </div>
        <span className="font-bold text-gray-600 dark:text-slate-400 text-sm">Add Machine</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Grouping and Filtering Panel */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-3.5 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, brand, or body part..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold py-2.5 pl-9 pr-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-105 dark:border-slate-700/80 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all placeholder:text-gray-400"
            />
          </div>

          {/* Equipment Type Filter Switcher */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-950/40 rounded-xl p-1 shrink-0 border border-gray-200 dark:border-slate-800">
            <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 pl-2 pr-1 uppercase tracking-wider">Type:</span>
            <button
              onClick={() => setSelectedTypeFilter('All')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${selectedTypeFilter === 'All' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedTypeFilter('Machine')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${selectedTypeFilter === 'Machine' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Machine
            </button>
            <button
              onClick={() => setSelectedTypeFilter('Weightlifting')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${selectedTypeFilter === 'Weightlifting' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Weightlifting
            </button>
            <button
              onClick={() => setSelectedTypeFilter('Exercise')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${selectedTypeFilter === 'Exercise' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Exercise
            </button>
          </div>

          {/* Group Options */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-950/40 rounded-xl p-1 shrink-0 border border-gray-200 dark:border-slate-800">
            <span className="text-[10px] font-extrabold text-gray-400 dark:text-slate-500 pl-2 pr-1 uppercase tracking-wider">Group:</span>
            <button
              onClick={() => setGroupBy('none')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${groupBy === 'none' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              None
            </button>
            <button
              onClick={() => setGroupBy('category')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${groupBy === 'category' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Body Part
            </button>
            <button
              onClick={() => setGroupBy('brand')}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all ${groupBy === 'brand' ? 'bg-white dark:bg-slate-800 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
            >
              Brand
            </button>
          </div>
        </div>

        {/* Filters Selectors */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Filter size={12} className="text-gray-400" />
            <span className="font-bold text-gray-600 dark:text-slate-400">Filter Body Part:</span>
            <div className="w-[120px]">
              <Dropdown
                value={selectedFilterCategory}
                onChange={(val) => setSelectedFilterCategory(val)}
                options={categories}
                buttonClassName="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-lg text-xs font-bold py-1 px-1.5 text-gray-800 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Building2 size={12} className="text-gray-400" />
            <span className="font-bold text-gray-600 dark:text-slate-400">Filter Brand:</span>
            <div className="w-[120px]">
              <Dropdown
                value={selectedFilterBrand}
                onChange={(val) => setSelectedFilterBrand(val)}
                options={brands}
                buttonClassName="w-full flex items-center justify-between bg-gray-50 dark:bg-slate-800 border border-gray-150 dark:border-slate-700 rounded-lg text-xs font-bold py-1 px-1.5 text-gray-800 dark:text-white focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 select-none">
            <Clock size={12} className="text-gray-400" />
            <span className="font-bold text-gray-600 dark:text-slate-400">Sort by Last Used:</span>
            <button
              type="button"
              id="sort-by-last-used-toggle"
              onClick={() => setSortByLastUsed(!sortByLastUsed)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white ${
                sortByLastUsed ? 'bg-cyan-500' : 'bg-gray-200 dark:bg-slate-700/80'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  sortByLastUsed ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 select-none">
            <Zap size={12} className={sortByFatigue ? 'text-amber-500 fill-amber-500' : 'text-gray-400'} />
            <span className="font-bold text-gray-600 dark:text-slate-400">Sort by Fatigue:</span>
            <button
              type="button"
              id="sort-by-fatigue-toggle"
              onClick={() => setSortByFatigue(!sortByFatigue)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white ${
                sortByFatigue ? 'bg-cyan-500' : 'bg-gray-200 dark:bg-slate-700/80'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  sortByFatigue ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {!sortByLastUsed && !sortByFatigue && lastUsedMachines.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500 select-none bg-gray-50 dark:bg-slate-950/40 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-slate-800">
              <span className="font-bold text-gray-600 dark:text-slate-400">Recent Cards (1-15):</span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 rounded-lg px-1.5 py-0.5 border border-gray-150 dark:border-slate-700 shadow-sm">
                <button
                  type="button"
                  id="dec-recent-cards"
                  onClick={() => setRecentCardsCount(prev => Math.max(1, prev - 1))}
                  disabled={recentCardsCount <= 1}
                  className="p-0.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Show fewer recent cards"
                >
                  <ChevronLeft size={13} strokeWidth={2.5} />
                </button>
                <div className="relative w-16 flex items-center">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={recentCardsCount}
                    onChange={(e) => setRecentCardsCount(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer h-1 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none"
                    style={{ WebkitAppearance: 'none' }}
                  />
                </div>
                <button
                  type="button"
                  id="inc-recent-cards"
                  onClick={() => setRecentCardsCount(prev => Math.min(15, prev + 1))}
                  disabled={recentCardsCount >= 15}
                  className="p-0.5 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Show more recent cards"
                >
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
                <span className="text-[11px] font-extrabold text-cyan-600 dark:text-cyan-400 w-4 text-center">
                  {recentCardsCount}
                </span>
              </div>
            </div>
          )}

          {(selectedFilterCategory !== 'All' || selectedFilterBrand !== 'All' || selectedTypeFilter !== 'All' || searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedFilterCategory('All');
                setSelectedFilterBrand('All');
                setSelectedTypeFilter('All');
                setSearchQuery('');
              }}
              className="text-[10px] bg-red-50 dark:bg-red-950/25 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 font-extrabold px-2 py-1 rounded-md transition-colors uppercase tracking-wider ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {displayedRecentMachines.length > 0 && !isEditMode && !sortByLastUsed && !sortByFatigue && searchQuery === '' && selectedFilterCategory === 'All' && selectedFilterBrand === 'All' && selectedTypeFilter === 'All' && (
        <div className="mb-8 pb-6 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Last Activity ({displayedRecentMachines.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayedRecentMachines.map(m => (
              <React.Fragment key={m.name}>
                {renderMachineCard(m)}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {groupBy !== 'none' ? (
          <div className="space-y-8 col-span-full">
            {Object.entries(groupBy === 'category' ? groupedByCategory : groupedByBrand).map(([groupName, groupMachinesRaw]) => {
              const groupMachines = groupMachinesRaw as typeof filteredMachines;
              if (groupMachines.length === 0) return null;
              return (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-gray-100 dark:border-slate-800/80">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-450">
                      {groupName}
                    </h3>
                    <span className="text-[11px] bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-extrabold px-1.5 py-0.5 rounded-full">
                      {groupMachines.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {groupMachines.map(m => renderMachineCard(m))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {filteredMachines.map(m => renderMachineCard(m))}
            {renderAddMachineButton()}
          </>
        )}
      </div>
    </div>
  );
}

