import { WorkoutSet, MachineConfig } from "../types";
import { MACHINES } from "../components/MachineList";
import { MUSCLES } from "../data/muscleData";

export function calculateFatigueScores(sets: WorkoutSet[], machineConfigs: MachineConfig[]) {
  const groupFatigue: Record<string, number> = {
    Chest: 0,
    Back: 0,
    Shoulders: 0,
    Arms: 0,
    Legs: 0,
    Glutes: 0,
    Core: 0,
  };

  const now = Date.now();

  // Build O(1) lookup indexes for machine configs, machines presets, and muscles
  const configMap = new Map<string, MachineConfig>();
  machineConfigs.forEach(c => {
    if (c.exercise) configMap.set(c.exercise.toLowerCase(), c);
  });

  const defaultMachineMap = new Map<string, typeof MACHINES[0]>();
  MACHINES.forEach(m => {
    if (m.name) defaultMachineMap.set(m.name.toLowerCase(), m);
  });

  const muscleMap = new Map<string, typeof MUSCLES[0]>();
  const muscleGroupMap = new Map<string, typeof MUSCLES>();
  const muscleIdSet = new Set<string>();

  MUSCLES.forEach(m => {
    muscleMap.set(m.id, m);
    muscleIdSet.add(m.id);
    if (!muscleGroupMap.has(m.group)) {
      muscleGroupMap.set(m.group, []);
    }
    muscleGroupMap.get(m.group)!.push(m);
  });
  // Also register unilateral oblique channels for directional fatigue tracking
  muscleIdSet.add('obliques_left');
  muscleIdSet.add('obliques_right');

  const sortedSets = [...sets].sort((a, b) => {
    const timeA = a.date ? ((a.date as any).toMillis?.() || (a.date as any).seconds * 1000 || new Date(a.date as any).getTime()) : 0;
    const timeB = b.date ? ((b.date as any).toMillis?.() || (b.date as any).seconds * 1000 || new Date(b.date as any).getTime()) : 0;
    return timeA - timeB;
  });

  const muscleFatigueLastUpdate: Record<string, number> = {};
  const groupFatigueLastUpdate: Record<string, number> = {};

  sortedSets.forEach(set => {
    if (!set.exercise) return;
    const lowerExercise = set.exercise.toLowerCase();
    const config = configMap.get(lowerExercise);
    const defaultMac = defaultMachineMap.get(lowerExercise);

    let groupsToFatigue: string[] = [];
    let musclesToFatigue: string[] = [];

    if (config?.linkedGroups && config.linkedGroups.length > 0) {
      groupsToFatigue = [...config.linkedGroups];
    }
    if (config?.linkedMuscles && config.linkedMuscles.length > 0) {
      musclesToFatigue = [...config.linkedMuscles];
      config.linkedMuscles.forEach(mId => {
        const muscleDef = muscleMap.get(mId);
        if (muscleDef && !groupsToFatigue.includes(muscleDef.group)) {
          groupsToFatigue.push(muscleDef.group);
        }
      });
    }

    if (groupsToFatigue.length === 0 && musclesToFatigue.length === 0) {
      let group = '';
      if (set.variant && config?.variantCategories?.[set.variant]) {
        group = config.variantCategories[set.variant];
      }
      else if (config?.category) {
        group = config.category;
      }
      else if (defaultMac?.category) {
        group = defaultMac.category;
      }
      
      if (!group) {
        const name = lowerExercise;
        if (name.includes('press') || name.includes('push') || name.includes('fly')) group = 'Chest';
        else if (name.includes('pull') || name.includes('row') || name.includes('chin')) group = 'Back';
        else if (name.includes('curl')) group = 'Arms';
        else if (name.includes('squat') || name.includes('leg') || name.includes('calf')) group = 'Legs';
        else if (name.includes('glute') || name.includes('hip') || name.includes('thrust')) group = 'Glutes';
        else if (name.includes('crunch') || name.includes('plank') || name.includes('core')) group = 'Core';
      }

      if (group) {
        groupsToFatigue.push(group);
        const groupMuscles = muscleGroupMap.get(group);
        if (groupMuscles) {
          groupMuscles.forEach(mDef => {
            musclesToFatigue.push(mDef.id);
          });
        }
      }
    }

    // Biomechanical Unilateral Depletion for Rotary Torso & Oblique movements
    const isRotaryTorso = lowerExercise.includes('rotary') || 
                          lowerExercise.includes('torso') || 
                          lowerExercise.includes('twist') ||
                          lowerExercise.includes('woodchop');

    if (isRotaryTorso || (set.degrees !== undefined && set.degrees !== null && (musclesToFatigue.includes('obliques') || groupsToFatigue.includes('Core')))) {
      if (set.degrees !== undefined && set.degrees !== null) {
        const deg = Number(set.degrees);
        if (deg > 0) {
          // Positive degrees (e.g. +70°) rotates toward the left -> primarily taxes Left External Obliques
          musclesToFatigue = musclesToFatigue.filter(m => m !== 'obliques');
          if (!musclesToFatigue.includes('obliques_left')) {
            musclesToFatigue.push('obliques_left');
          }
          if (!groupsToFatigue.includes('Core')) groupsToFatigue.push('Core');
        } else if (deg < 0) {
          // Negative degrees (e.g. -70°) rotates toward the right -> primarily taxes Right External Obliques
          musclesToFatigue = musclesToFatigue.filter(m => m !== 'obliques');
          if (!musclesToFatigue.includes('obliques_right')) {
            musclesToFatigue.push('obliques_right');
          }
          if (!groupsToFatigue.includes('Core')) groupsToFatigue.push('Core');
        } else {
          // 0 degrees -> bilateral depletion
          if (!musclesToFatigue.includes('obliques_left')) musclesToFatigue.push('obliques_left');
          if (!musclesToFatigue.includes('obliques_right')) musclesToFatigue.push('obliques_right');
          if (!musclesToFatigue.includes('obliques')) musclesToFatigue.push('obliques');
        }
      } else {
        // Unspecified angle -> bilateral depletion
        if (!musclesToFatigue.includes('obliques_left')) musclesToFatigue.push('obliques_left');
        if (!musclesToFatigue.includes('obliques_right')) musclesToFatigue.push('obliques_right');
        if (!musclesToFatigue.includes('obliques')) musclesToFatigue.push('obliques');
      }
    }

    let setTime = now - 4 * 24 * 60 * 60 * 1000;
    const targetDate = set.date || set.createdAt;
    
    if (targetDate) {
      if ((targetDate as any).toMillis) {
        setTime = (targetDate as any).toMillis();
      } else if ((targetDate as any).toDate) {
        setTime = (targetDate as any).toDate().getTime();
      } else if ((targetDate as any).seconds) {
        setTime = (targetDate as any).seconds * 1000;
      } else if (targetDate instanceof Date) {
        setTime = targetDate.getTime();
      } else if (typeof targetDate === 'string') {
        setTime = new Date(targetDate).getTime();
      } else if (typeof targetDate === 'number') {
        setTime = targetDate;
      }
    }

    if (now - setTime > 168 * 3600 * 1000) return;

    const reps = set.reps || 10;
    let baseFatigue = Math.max(0.20, 0.60 - (reps * 0.015)); 
    
    if (set.weightModifier !== undefined && set.weightModifier > 0) {
      baseFatigue *= (set.weightModifier / 100);
    }
    
    const numMuscles = musclesToFatigue.length || 1;
    const spreadFactor = 1 / Math.pow(numMuscles, 0.2); 
    const addedFatigue = baseFatigue * spreadFactor;

    const applyDecay = (currentF: number, lastTime: number, newTime: number) => {
      if (!lastTime || newTime <= lastTime) return currentF;
      const hoursPassed = (newTime - lastTime) / (1000 * 60 * 60);
      const decayFactor = Math.pow(0.5, hoursPassed / 48);
      return currentF * decayFactor;
    };

    groupsToFatigue.forEach(g => {
      const currentF = groupFatigue[g] !== undefined ? groupFatigue[g] : 0;
      const lastTime = groupFatigueLastUpdate[g] || 0;
      const decayedF = applyDecay(currentF, lastTime, setTime);
      groupFatigue[g] = decayedF + addedFatigue * (1 - decayedF);
      groupFatigueLastUpdate[g] = setTime;
    });

    musclesToFatigue.forEach(mId => {
      const currentF = groupFatigue[mId] !== undefined ? groupFatigue[mId] : 0;
      const lastTime = muscleFatigueLastUpdate[mId] || 0;
      const muscleAddedFatigue = addedFatigue * 1.2; 
      const decayedF = applyDecay(currentF, lastTime, setTime);
      groupFatigue[mId] = decayedF + muscleAddedFatigue * (1 - decayedF);
      muscleFatigueLastUpdate[mId] = setTime;
    });
  });

  Object.keys(groupFatigue).forEach(key => {
    const isMuscle = muscleIdSet.has(key);
    const lastTime = isMuscle ? muscleFatigueLastUpdate[key] : groupFatigueLastUpdate[key];
    if (lastTime) {
      const hoursPassed = (now - lastTime) / (1000 * 60 * 60);
      const decayFactor = Math.pow(0.5, hoursPassed / 48);
      groupFatigue[key] = groupFatigue[key] * decayFactor;
    }
  });

  return groupFatigue;
}
