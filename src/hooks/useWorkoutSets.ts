import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, getDocs, Timestamp, writeBatch, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { WorkoutSet, MachineConfig } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firebase-errors';
import { parseGoogleSheetCSV } from '../utils/csv-parser';
import { getPresetsForMachine } from '../utils/machinePresets';

function cleanData<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj };
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });
  return result;
}

export function useWorkoutSets() {
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [machineConfigs, setMachineConfigs] = useState<MachineConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSets: (() => void) | null = null;
    let unsubscribeConfigs: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSets) {
        unsubscribeSets();
        unsubscribeSets = null;
      }
      if (unsubscribeConfigs) {
        unsubscribeConfigs();
        unsubscribeConfigs = null;
      }

      if (!user) {
        setSets([]);
        setMachineConfigs([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const q = query(
        collection(db, 'users', user.uid, 'workoutSets'),
        orderBy('date', 'desc')
      );

      unsubscribeSets = onSnapshot(q, (snapshot) => {
        const results: WorkoutSet[] = snapshot.docs.map(doc => ({
          ...(doc.data() as WorkoutSet),
          id: doc.id
        }));
        setSets(results);
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/workoutSets`);
        setLoading(false);
      });

      const qConfigs = query(
        collection(db, 'users', user.uid, 'machineConfigs')
      );

      unsubscribeConfigs = onSnapshot(qConfigs, (snapshot) => {
        const results: MachineConfig[] = snapshot.docs.map(doc => ({
          ...(doc.data() as MachineConfig),
          id: doc.id
        }));
        setMachineConfigs(results);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/machineConfigs`);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSets) unsubscribeSets();
      if (unsubscribeConfigs) unsubscribeConfigs();
    };
  }, []);

  const addSet = useCallback(async (setData: Omit<WorkoutSet, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    try {
      const newSet = cleanData({
        ...setData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, 'users', user.uid, 'workoutSets'), newSet);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/workoutSets`);
    }
  }, []);

  const updateSet = useCallback(async (setId: string, setData: Partial<Omit<WorkoutSet, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    try {
      const docRef = doc(db, 'users', user.uid, 'workoutSets', setId);
      await setDoc(docRef, cleanData({
        ...setData,
        updatedAt: serverTimestamp()
      }), { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/workoutSets/${setId}`);
    }
  }, []);

  const deleteSet = useCallback(async (setId: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    try {
      const docRef = doc(db, 'users', user.uid, 'workoutSets', setId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/workoutSets/${setId}`);
    }
  }, []);

  const saveMachineConfig = useCallback(async (
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
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    try {
      const queryName = (oldExercise || exercise).toLowerCase();
      const existing = machineConfigs.find(c => c.exercise.toLowerCase() === queryName);
      
      const hasNameChanged = oldExercise && oldExercise.toLowerCase() !== exercise.toLowerCase();
      const originalNameValue = existing?.originalName || (hasNameChanged ? oldExercise : undefined);

      if (existing && existing.id) {
        const docRef = doc(db, 'users', user.uid, 'machineConfigs', existing.id);
        const updateData: any = {
          userId: user.uid,
          exercise,
          baseWeightLbs,
          baseWeightKg,
          createdAt: existing.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (brand !== undefined) updateData.brand = brand;
        else if (existing.brand !== undefined) updateData.brand = existing.brand;

        if (category !== undefined) updateData.category = category;
        else if (existing.category !== undefined) updateData.category = existing.category;

        if (variantCategories !== undefined) updateData.variantCategories = variantCategories;
        else if (existing.variantCategories !== undefined) updateData.variantCategories = existing.variantCategories;

        if (type !== undefined) updateData.type = type;
        else if (existing.type !== undefined) updateData.type = existing.type;

        if (linkedMuscles !== undefined) updateData.linkedMuscles = linkedMuscles;
        else if (existing.linkedMuscles !== undefined) updateData.linkedMuscles = existing.linkedMuscles;

        if (linkedGroups !== undefined) updateData.linkedGroups = linkedGroups;
        else if (existing.linkedGroups !== undefined) updateData.linkedGroups = existing.linkedGroups;

        if (customFields !== undefined) updateData.customFields = customFields;
        else if (existing.customFields !== undefined) updateData.customFields = existing.customFields;

        if (invertWeight !== undefined) updateData.invertWeight = invertWeight;
        else if (existing.invertWeight !== undefined) updateData.invertWeight = existing.invertWeight;

        if (invertBaseWeight !== undefined) updateData.invertBaseWeight = invertBaseWeight;
        else if (existing.invertBaseWeight !== undefined) updateData.invertBaseWeight = existing.invertBaseWeight;

        if (postures !== undefined) updateData.postures = postures;
        else if (existing.postures !== undefined) updateData.postures = existing.postures;

        if (originalNameValue !== undefined) {
          updateData.originalName = originalNameValue;
        }

        await updateDoc(docRef, cleanData(updateData));
      } else {
        const docRef = doc(collection(db, 'users', user.uid, 'machineConfigs'));
        const insertData: any = {
          userId: user.uid,
          exercise,
          baseWeightLbs,
          baseWeightKg,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (brand) insertData.brand = brand;
        if (category) insertData.category = category;
        if (variantCategories) insertData.variantCategories = variantCategories;
        if (type) insertData.type = type;

        const preset = getPresetsForMachine(exercise);

        if (linkedMuscles) {
          insertData.linkedMuscles = linkedMuscles;
        } else if (preset && preset.muscles.length > 0) {
          insertData.linkedMuscles = preset.muscles;
        }

        if (linkedGroups) {
          insertData.linkedGroups = linkedGroups;
        } else if (preset && preset.groups.length > 0) {
          insertData.linkedGroups = preset.groups;
        }

        if (customFields) insertData.customFields = customFields;
        if (originalNameValue) insertData.originalName = originalNameValue;
        if (invertWeight !== undefined) insertData.invertWeight = invertWeight;
        if (invertBaseWeight !== undefined) insertData.invertBaseWeight = invertBaseWeight;
        if (postures !== undefined) insertData.postures = postures;

        await setDoc(docRef, cleanData(insertData));
      }

      if (hasNameChanged) {
        const setsQuery = query(
          collection(db, 'users', user.uid, 'workoutSets'),
          where('exercise', '==', oldExercise)
        );
        const querySnapshot = await getDocs(setsQuery);
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
              exercise,
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/machineConfigs`);
    }
  }, [machineConfigs]);

  const saveMachineConfigsBatch = useCallback(async (
    configsToSave: Array<{
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
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    if (!configsToSave || configsToSave.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const item of configsToSave) {
        const queryName = item.exercise.toLowerCase();
        const existing = machineConfigs.find(c => c.exercise.toLowerCase() === queryName);
        if (existing && existing.id) {
          const docRef = doc(db, 'users', user.uid, 'machineConfigs', existing.id);
          const updateData: any = {
            userId: user.uid,
            exercise: item.exercise,
            baseWeightLbs: item.baseWeightLbs ?? existing.baseWeightLbs ?? 0,
            baseWeightKg: item.baseWeightKg ?? existing.baseWeightKg ?? 0,
            createdAt: existing.createdAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (item.brand !== undefined) updateData.brand = item.brand;
          else if (existing.brand !== undefined) updateData.brand = existing.brand;

          if (item.category !== undefined) updateData.category = item.category;
          else if (existing.category !== undefined) updateData.category = existing.category;

          if (item.variantCategories !== undefined) updateData.variantCategories = item.variantCategories;
          else if (existing.variantCategories !== undefined) updateData.variantCategories = existing.variantCategories;

          if (item.type !== undefined) updateData.type = item.type;
          else if (existing.type !== undefined) updateData.type = existing.type;

          if (item.linkedMuscles !== undefined) updateData.linkedMuscles = item.linkedMuscles;
          else if (existing.linkedMuscles !== undefined) updateData.linkedMuscles = existing.linkedMuscles;

          if (item.linkedGroups !== undefined) updateData.linkedGroups = item.linkedGroups;
          else if (existing.linkedGroups !== undefined) updateData.linkedGroups = existing.linkedGroups;

          if (item.customFields !== undefined) updateData.customFields = item.customFields;
          else if (existing.customFields !== undefined) updateData.customFields = existing.customFields;

          batch.update(docRef, cleanData(updateData));
        } else {
          const docRef = doc(collection(db, 'users', user.uid, 'machineConfigs'));
          const insertData: any = {
            userId: user.uid,
            exercise: item.exercise,
            baseWeightLbs: item.baseWeightLbs ?? 0,
            baseWeightKg: item.baseWeightKg ?? 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (item.brand) insertData.brand = item.brand;
          if (item.category) insertData.category = item.category;
          if (item.variantCategories) insertData.variantCategories = item.variantCategories;
          if (item.type) insertData.type = item.type;
          if (item.linkedMuscles) insertData.linkedMuscles = item.linkedMuscles;
          if (item.linkedGroups) insertData.linkedGroups = item.linkedGroups;
          if (item.customFields) insertData.customFields = item.customFields;

          batch.set(docRef, cleanData(insertData));
        }
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/machineConfigs (batch)`);
    }
  }, [machineConfigs]);

  const seedData = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    setLoading(true);

    try {
      // Check if we already have data
      const q = query(collection(db, 'users', user.uid, 'workoutSets'));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setLoading(false);
        return; // Already seeded or has data
      }

      const batch = writeBatch(db);
      const seedDate = Timestamp.fromDate(new Date('2026-07-06T12:00:00Z'));
      const timestamp = serverTimestamp();

      const seedRecords: any[] = [
        // Arm Curl
        { exercise: 'Arm Curl', rep: 6, weightLbs: 100, weightKg: 45 },
        { exercise: 'Arm Curl', rep: 6, weightLbs: 90, weightKg: 40.5 },
        { exercise: 'Arm Curl', rep: 8, weightLbs: 80, weightKg: 36 },
        { exercise: 'Arm Curl', rep: 8, weightLbs: 80, weightKg: 36 },
        
        // Abdominal
        { exercise: 'Abdominal', rep: 10, weightLbs: 70, weightKg: 31.5 },
        { exercise: 'Abdominal', rep: 8, weightLbs: 80, weightKg: 36 },
        { exercise: 'Abdominal', rep: 8, weightLbs: 70, weightKg: 31.5 },
        { exercise: 'Abdominal', rep: 8, weightLbs: 70, weightKg: 31.5 },
        
        // Pec fly
        { exercise: 'Pec fly', rep: 8, weightLbs: 145, weightKg: 65.25 },
        { exercise: 'Pec fly', rep: 8, weightLbs: 145, weightKg: 65.25 },
        { exercise: 'Pec fly', rep: 8, weightLbs: 160, weightKg: 72 },
        { exercise: 'Pec fly', rep: 6, weightLbs: 160, weightKg: 72 },
        
        // Rotary Torso
        { exercise: 'Rotary Torso', rep: 8, weightLbs: 100, weightKg: 45, degrees: 70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: -70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: 70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: -70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: 70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: -70 },
        { exercise: 'Rotary Torso', rep: 10, weightLbs: 100, weightKg: 45, degrees: 70 },
        { exercise: 'Rotary Torso', rep: 8, weightLbs: 100, weightKg: 45, degrees: -70 },
        
        // Perfect Squat
        { exercise: 'Perfect Squat', rep: 10, weightLbs: 155.55, weightKg: 70 },
        { exercise: 'Perfect Squat', rep: 10, weightLbs: 155.55, weightKg: 70 },
        { exercise: 'Perfect Squat', rep: 8, weightLbs: 200, weightKg: 90 },
        { exercise: 'Perfect Squat', rep: 8, weightLbs: 200, weightKg: 90 },
        
        // Glute Trainer
        { exercise: 'Glute Trainer', rep: 8, weightLbs: 105.55, weightKg: 47.5 },
        { exercise: 'Glute Trainer', rep: 8, weightLbs: 105.55, weightKg: 47.5 },
        { exercise: 'Glute Trainer', rep: 8, weightLbs: 116.66, weightKg: 52.5 },
        { exercise: 'Glute Trainer', rep: 8, weightLbs: 116.66, weightKg: 52.5 },
      ].map(s => ({ ...s, reps: s.rep, date: seedDate }));

      seedRecords.forEach(record => {
        const newDocRef = doc(collection(db, 'users', user.uid, 'workoutSets'));
        // remove the 'rep' property if present
        const cleanRecord = { ...record };
        if ('rep' in cleanRecord) { delete (cleanRecord as any).rep; }
        
        batch.set(newDocRef, {
          ...cleanRecord,
          userId: user.uid,
          createdAt: timestamp,
          updatedAt: timestamp
        });
      });

      await batch.commit();

    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/workoutSets (batch)`);
    } finally {
      setLoading(false);
    }
  };

  const importCSV = async (csvText: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    setLoading(true);

    try {
      const { sets: parsedSets, configs: parsedConfigs } = parseGoogleSheetCSV(csvText);
      const timestamp = serverTimestamp();

      // 1. Create or update machine configurations
      for (const config of parsedConfigs) {
        await saveMachineConfig(
          config.exercise,
          config.baseWeightLbs,
          config.baseWeightKg,
          config.brand,
          config.category,
          config.variantCategories,
          config.type
        );
      }

      // 2. Clear out any existing sets first if importing clean data to avoid duplicate matches,
      // or we can append since we want robust behavior. Let's append by writing sets in batched queries.
      const batches = [];
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      for (const s of parsedSets) {
        const newDocRef = doc(collection(db, 'users', user.uid, 'workoutSets'));
        
        // Convert JS date to Firestore Timestamp
        const dateTimestamp = Timestamp.fromDate(s.date);

        currentBatch.set(newDocRef, {
          ...s,
          date: dateTimestamp,
          userId: user.uid,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        batchCount++;
        if (batchCount >= 450) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        batches.push(currentBatch);
      }

      // Commit batches sequentially
      for (const b of batches) {
        await b.commit();
      }

      return {
        success: true,
        setsCount: parsedSets.length,
        configsCount: parsedConfigs.length
      };

    } catch (err: any) {
      console.error('CSV Import Error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const repairFlippedDates = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      sets.forEach((setItem) => {
        if (!setItem.date || !setItem.id) return;
        const dateObj = (setItem.date as any).toDate ? (setItem.date as any).toDate() : new Date(setItem.date as any);
        const d = dateObj.getDate();
        const m = dateObj.getMonth() + 1; // 1-indexed
        
        if (d <= 12 && m <= 12 && d !== m) {
          const newDate = new Date(
            dateObj.getFullYear(),
            d - 1, // Swap month (former day)
            m,     // Swap day (former month)
            dateObj.getHours(),
            dateObj.getMinutes(),
            dateObj.getSeconds()
          );
          
          const docRef = doc(db, 'users', user.uid, 'workoutSets', setItem.id);
          batch.update(docRef, {
            date: Timestamp.fromDate(newDate),
            updatedAt: serverTimestamp()
          });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }
      return count;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/workoutSets (repair bulk)`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const applyPresetsToExistingMachines = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      machineConfigs.forEach((config) => {
        if (!config.id) return;
        const preset = getPresetsForMachine(config.exercise);
        if (preset) {
          let hasUpdates = false;
          const updates: any = { updatedAt: serverTimestamp() };
          
          if (!config.linkedGroups || config.linkedGroups.length === 0) {
            updates.linkedGroups = preset.groups;
            hasUpdates = true;
          }
          if (!config.linkedMuscles || config.linkedMuscles.length === 0) {
            updates.linkedMuscles = preset.muscles;
            hasUpdates = true;
          }
          
          if (hasUpdates) {
            const docRef = doc(db, 'users', user.uid, 'machineConfigs', config.id);
            batch.update(docRef, updates);
            count++;
          }
        }
      });
      
      if (count > 0) {
        await batch.commit();
      }
      return count;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/machineConfigs (apply presets)`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { sets, machineConfigs, loading, addSet, updateSet, deleteSet, saveMachineConfig, saveMachineConfigsBatch, seedData, importCSV, repairFlippedDates, applyPresetsToExistingMachines };
}
