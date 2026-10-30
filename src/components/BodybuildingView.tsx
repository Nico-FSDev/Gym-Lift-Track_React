import React, { useState } from 'react';
import { Dumbbell, ArrowLeft, Pencil, X, Check, Plus, User, Eye } from 'lucide-react';
import MachineList, { MACHINES } from './MachineList';
import AddWorkoutForm from './AddWorkoutForm';
import { WorkoutSet, MachineConfig } from '../types';
import AnatomicalAvatar from './AnatomicalAvatar';

interface BodybuildingViewProps {
  addSet: (data: any) => Promise<void>;
  updateSet: (id: string, data: any) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  onSuccess: (exercise?: string) => void;
  sets: WorkoutSet[];
  machineConfigs: MachineConfig[];
  saveMachineConfig: (
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
    customFields?: string[]
  ) => Promise<void>;
  initialExercise?: string;
  onNavigateToTab?: (tab: string) => void;
}

import Dropdown from './Dropdown';

export default function BodybuildingView({ 
  addSet, 
  updateSet,
  deleteSet,
  onSuccess, 
  sets, 
  machineConfigs, 
  saveMachineConfig,
  initialExercise,
  onNavigateToTab
}: BodybuildingViewProps) {
  const [activeTab, setActiveTab] = useState<'workout' | 'avatar'>('workout');
  const [hasMountedAvatar, setHasMountedAvatar] = useState<boolean>(false);
  const [selectedMachine, setSelectedMachine] = useState<string>(initialExercise || '');

  React.useEffect(() => {
    if (activeTab === 'avatar' && !hasMountedAvatar) {
      setHasMountedAvatar(true);
    }
  }, [activeTab, hasMountedAvatar]);

  React.useEffect(() => {
    if (initialExercise) {
      setSelectedMachine(initialExercise);
      setActiveTab('workout');
    }
  }, [initialExercise]);
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [avatarGroup, setAvatarGroup] = useState<string>('All');
  const [linkingExercise, setLinkingExercise] = useState<string | null>(null);
  
  // Edit mode toggling state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingMachine, setEditingMachine] = useState<string | null>(null);
  const [isCreatingNewMachine, setIsCreatingNewMachine] = useState<boolean>(false);

  // Machine characteristics state in Modal
  const [machineNameInput, setMachineNameInput] = useState<string>('');
  const [brand, setBrand] = useState<string>('Standard');
  const [isCustomBrand, setIsCustomBrand] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Custom');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [baseWeightLbs, setBaseWeightLbs] = useState<number>(0);
  const [baseWeightKg, setBaseWeightKg] = useState<number>(0);
  const [variantCategories, setVariantCategories] = useState<Record<string, string>>({});
  const [type, setType] = useState<'Machine' | 'Weightlifting' | 'Exercise'>('Machine');
  const [customFieldsState, setCustomFieldsState] = useState<string[]>([]);
  const [newCustomFieldName, setNewCustomFieldName] = useState<string>('');
  
  // Intersecting dynamic state for the sub-form adding options
  const [newVariantName, setNewVariantName] = useState<string>('');
  const [newVariantMuscle, setNewVariantMuscle] = useState<string>('Chest');

  const handleMachineSelect = (machine: string, variant?: string) => {
    if (machine === '__NEW_MACHINE__') {
      setEditingMachine(null);
      setMachineNameInput('');
      setBrand('Standard');
      setIsCustomBrand(false);
      setCategory('Arms');
      setIsCustomCategory(false);
      setBaseWeightLbs(0);
      setBaseWeightKg(0);
      setVariantCategories({});
      setType('Machine');
      setCustomFieldsState([]);
      setNewCustomFieldName('');
      setIsCreatingNewMachine(true);
    } else {
      setSelectedMachine(machine);
      setSelectedVariant(variant || '');
    }
  };

  const handleSelectMachineByCategory = (cat: string) => {
    setActiveCategoryFilter(cat);
    setSelectedMachine(''); // reset any active logging card
    setActiveTab('workout'); // flip tab back to workout
  };

  const handleMachineEdit = (machineName: string) => {
    const config = machineConfigs.find(c => c.exercise.toLowerCase() === machineName.toLowerCase());
    
    // Find default category
    const defaultMac = MACHINES.find(m => m.name.toLowerCase() === machineName.toLowerCase());
    const defaultCat = defaultMac ? defaultMac.category : 'Custom';
    const defaultType = defaultMac ? (defaultMac as any).type || 'Machine' : 'Machine';

    setEditingMachine(machineName);
    setMachineNameInput(machineName);
    setIsCreatingNewMachine(false);

    // Seed state values
    const seedBrand = config?.brand || 'Standard';
    setBrand(seedBrand);
    setIsCustomBrand(!['Matrix', 'Life Fitness', 'Technogym', 'Hammer Strength', 'Rogue', 'Standard'].includes(seedBrand));

    const seedCategory = config?.category || defaultCat;
    setCategory(seedCategory);
    setIsCustomCategory(!['Arms', 'Chest', 'Legs', 'Core', 'Back', 'Shoulders', 'Glutes'].includes(seedCategory));

    setBaseWeightLbs(config?.baseWeightLbs || 0);
    setBaseWeightKg(config?.baseWeightKg || 0);
    setVariantCategories(config?.variantCategories || {});
    setType(config?.type || (defaultType as 'Machine' | 'Weightlifting' | 'Exercise'));
    setCustomFieldsState(config?.customFields || []);
    setNewCustomFieldName('');
    
    setNewVariantName('');
  };

  const handleSaveCharacteristics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine && !isCreatingNewMachine) return;
    const cleanNewName = machineNameInput.trim();
    if (!cleanNewName) return;

    try {
      if (!saveMachineConfig) {
        alert('Internal error: saveMachineConfig is not provided');
        return;
      }
      
      const toSaveBrand = isCustomBrand && brand.trim() ? brand.trim() : (brand || 'Standard');
      let toSaveCat = category.trim();
      if ((isCustomCategory || category === 'Custom') && (!toSaveCat || toSaveCat === 'Custom')) {
        toSaveCat = 'Custom';
      }

      await saveMachineConfig(
        cleanNewName,
        baseWeightLbs,
        baseWeightKg,
        toSaveBrand,
        toSaveCat,
        variantCategories,
        type,
        isCreatingNewMachine ? undefined : editingMachine,
        undefined,
        undefined,
        customFieldsState
      );
      setEditingMachine(null);
      if (isCreatingNewMachine) {
        setSelectedMachine(cleanNewName);
        setSelectedVariant('');
      }
      setIsCreatingNewMachine(false);
      setIsEditMode(false); // Reset pencil state after successful save
    } catch (err) {
      console.error('Failed to save machine config:', err);
      
      // Parse the thrown error which might be a JSON from handleFirestoreError
      let msg = String(err);
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          msg = parsed.error || err.message;
        } catch {
          msg = err.message;
        }
      }
      alert('Failed to save characteristic: ' + msg);
    }
  };

  // Unique list of options ever logged for the edited machine
  const computedMachineVariants = editingMachine
    ? Array.from(new Set(
        sets
          .filter(s => s.exercise.toLowerCase() === editingMachine.toLowerCase() && s.variant)
          .map(s => s.variant!)
      )).filter(Boolean)
    : [];

  return (
    <div className={`space-y-6 mx-auto transition-all duration-300 ${activeTab === 'avatar' ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <div className="flex items-center justify-center gap-3">
        <div className="flex-1 flex bg-gray-100 dark:bg-slate-800/50 p-1.5 rounded-2xl max-w-sm w-full shadow-inner">
          <button
            onClick={() => {
              setSelectedMachine('');
              setActiveTab('workout');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'workout' ? 'bg-white dark:bg-slate-900 shadow-md text-black dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}
          >
            <Dumbbell size={18} /> Workout
          </button>
          <button
            onClick={() => {
              setActiveTab('avatar');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${activeTab === 'avatar' ? 'bg-white dark:bg-slate-900 shadow-md text-black dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}
          >
            <Eye size={18} /> Avatar
          </button>
        </div>

        {/* Pencil configuration toggle tool (only showing when on Workout tab) */}
        {activeTab === 'workout' && !selectedMachine && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`p-3 rounded-2xl transition-all border ${
              isEditMode 
                ? 'bg-amber-500 text-white border-amber-600 scale-105 shadow-md shadow-amber-500/25' 
                : 'bg-gray-105 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-800/60 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-800'
            }`}
            title="Toggle Machine Edit Mode"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>

      {activeTab === 'workout' && (
         <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
           {selectedMachine ? (
             <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 relative animate-in fade-in duration-300 transition-colors">
               <button 
                 onClick={() => setSelectedMachine('')}
                 className="absolute top-6 left-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
               >
                 <ArrowLeft size={20} />
               </button>
               <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-8 text-center transition-colors">
                 Log {selectedMachine === '__NEW_MACHINE__' ? 'New Exercise / Machine' : selectedMachine}
               </h2>
               <AddWorkoutForm 
                 addSet={addSet} 
                 updateSet={updateSet}
                 deleteSet={deleteSet}
                 onSuccess={() => {
                   const machineToPass = selectedMachine === '__NEW_MACHINE__' ? undefined : selectedMachine;
                   setSelectedMachine(''); // Return back to list upon logging success!
                   onSuccess(machineToPass);
                 }} 
                 initialExercise={selectedMachine}
                 initialVariant={selectedVariant}
                 initialPosture={sets.find(s => s.exercise === selectedMachine)?.posture}
                 initialWeightModifier={sets.find(s => s.exercise === selectedMachine)?.weightModifier}
                 initialWeight={sets.find(s => s.exercise === selectedMachine)?.weightLbs}
                 initialReps={sets.find(s => s.exercise === selectedMachine)?.reps}
                 initialDegrees={sets.find(s => s.exercise === selectedMachine)?.degrees}
                 machineConfigs={machineConfigs}
                 saveMachineConfig={saveMachineConfig}
                 sets={sets} onExerciseRename={(newExercise) => setSelectedMachine(newExercise)}
                 onNavigateToTab={onNavigateToTab}
               />
             </div>
           ) : (
             <MachineList 
               onMachineSelect={handleMachineSelect} saveMachineConfig={saveMachineConfig} 
               onMachineEdit={handleMachineEdit}
               isEditMode={isEditMode}
               sets={sets} 
               machineConfigs={machineConfigs} 
               initialCategoryFilter={activeCategoryFilter}
               onCategoryTagClick={(category, exerciseName) => {
                 setAvatarGroup(category);
                 setLinkingExercise(exerciseName || null);
                 setActiveTab('avatar');
               }}
             />
           )}
         </div>
      )}
      
      {hasMountedAvatar && (
        <div className={activeTab === 'avatar' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-300' : 'hidden'}>
          <AnatomicalAvatar 
            sets={sets} 
            machineConfigs={machineConfigs} 
            onSelectMachineByCategory={handleSelectMachineByCategory}
            initialGroup={avatarGroup}
            onGroupChange={setAvatarGroup}
            linkingExercise={linkingExercise}
            onClearLinking={() => setLinkingExercise(null)}
            saveMachineConfig={saveMachineConfig}
          />
        </div>
      )}

      {/* Machine characteristics edit modal */}
      {(editingMachine !== null || isCreatingNewMachine) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-800 p-6 sm:p-8 space-y-6 relative animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => {
                setEditingMachine(null);
                setIsCreatingNewMachine(false);
              }}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">
                Machine Configurator
              </span>
              <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {isCreatingNewMachine ? "Create New Equipment" : `${editingMachine} Characteristics`}
              </h3>
            </div>

            <form onSubmit={handleSaveCharacteristics} className="space-y-5">
              {/* Card / Equipment name edit field */}
              <div className="space-y-1.5 transition-colors">
                <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                  Name / Identifier
                </label>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      placeholder="E.g. Pec Fly, Chest Press..."
                      value={machineNameInput}
                      onChange={(e) => setMachineNameInput(e.target.value)}
                      className="w-full text-xs font-semibold py-2.5 pl-3 pr-10 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white placeholder:text-gray-400"
                    />
                    {editingMachine && machineNameInput.trim() !== '' && machineNameInput.trim() !== editingMachine && (
                      <div className="absolute inset-y-0 right-3 flex items-center text-emerald-500 animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-emerald-550" />
                      </div>
                    )}
                  </div>

                  {editingMachine && machineNameInput.trim() !== '' && machineNameInput.trim() !== editingMachine && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.preventDefault();
                        const cleanNewName = machineNameInput.trim();
                        try {
                          await saveMachineConfig(
                            cleanNewName,
                            baseWeightLbs,
                            baseWeightKg,
                            brand || 'Standard',
                            category,
                            variantCategories,
                            type,
                            editingMachine,
                            undefined,
                            undefined,
                            customFieldsState
                          );
                          setEditingMachine(null);
                          setIsEditMode(false);
                        } catch (error) {
                          console.error("Failed to save renamed machine:", error);
                        }
                      }}
                      className="shrink-0 flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 animate-in fade-in slide-in-from-right-3 duration-200"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                      <span>Save Name</span>
                    </button>
                  )}
                </div>
                {editingMachine && machineNameInput.trim() !== '' && machineNameInput.trim() !== editingMachine && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium ml-1 animate-in fade-in duration-200">
                    ✨ Changing the name will automatically update all logged workout histories under this name.
                  </p>
                )}
              </div>

              {/* Type Selector (Machine vs Weightlifting vs Exercise) */}
              <div className="space-y-1.5 bg-gray-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-gray-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                  Equipment / Activity Type
                </label>
                <div className="flex bg-gray-200/60 dark:bg-slate-800 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setType('Machine')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      type === 'Machine'
                        ? 'bg-white dark:bg-slate-900 shadow-sm text-black dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                    }`}
                  >
                    Machine
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('Weightlifting')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      type === 'Weightlifting'
                        ? 'bg-white dark:bg-slate-900 shadow-sm text-black dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                    }`}
                  >
                    Weightlifting
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('Exercise')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      type === 'Exercise'
                        ? 'bg-white dark:bg-slate-900 shadow-sm text-black dark:text-white'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-white'
                    }`}
                  >
                    Exercise
                  </button>
                </div>
              </div>

              {/* Brand Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                  Brand / Manufacturer
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Matrix', 'Life Fitness', 'Technogym', 'Hammer Strength', 'Rogue', 'Standard'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setBrand(b);
                        setIsCustomBrand(false);
                      }}
                      className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all ${
                        brand === b && !isCustomBrand
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                          : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomBrand(true);
                      setBrand('');
                    }}
                    className={`py-2.5 px-3 text-xs font-bold rounded-xl border transition-all col-span-2 ${
                      isCustomBrand
                        ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-sm'
                        : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                    }`}
                  >
                    Custom Brand...
                  </button>
                </div>
                {isCustomBrand && (
                  <input
                    type="text"
                    placeholder="Type brand name..."
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white placeholder:text-gray-400"
                  />
                )}
              </div>

              {/* Muscle selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                  Primary Muscle Group
                </label>
                <div className="w-full">
                  <Dropdown
                    value={category === 'Custom' || !['Chest', 'Arms', 'Legs', 'Core', 'Back', 'Shoulders', 'Glutes'].includes(category) ? 'Custom' : category}
                    onChange={(val) => {
                      if (val === 'Custom') {
                        setCategory('Custom');
                        setIsCustomCategory(true);
                      } else {
                        setCategory(val);
                        setIsCustomCategory(false);
                      }
                    }}
                    options={[
                      { value: 'Arms', label: 'Arms' },
                      { value: 'Chest', label: 'Chest' },
                      { value: 'Glutes', label: 'Glutes' },
                      { value: 'Legs', label: 'Legs' },
                      { value: 'Core', label: 'Core' },
                      { value: 'Back', label: 'Back' },
                      { value: 'Shoulders', label: 'Shoulders' },
                      { value: 'Custom', label: 'Custom...' }
                    ]}
                    buttonClassName="w-full flex items-center justify-between text-xs font-bold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>
                {(isCustomCategory || category === 'Custom') && (
                  <input
                    type="text"
                    placeholder="Type muscular group concerned..."
                    value={category === 'Custom' ? '' : category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white mt-1.5 placeholder:text-gray-400"
                  />
                )}
              </div>

              {/* Base Weight Axis Offsets */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                    {type === 'Exercise' 
                      ? 'Body Weight (lbs)' 
                      : type === 'Weightlifting' 
                      ? 'Bar/Dumbbell Weight (lbs)' 
                      : 'Base Axis Offset (lbs)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={baseWeightLbs}
                    onChange={(e) => {
                      const lbs = parseFloat(e.target.value) || 0;
                      setBaseWeightLbs(lbs);
                      setBaseWeightKg(parseFloat((lbs * 0.45359237).toFixed(2)));
                    }}
                    className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-750 dark:text-slate-300">
                    {type === 'Exercise' 
                      ? 'Body Weight (kg)' 
                      : type === 'Weightlifting' 
                      ? 'Bar/Dumbbell Weight (kg)' 
                      : 'Base Axis Offset (kg)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={baseWeightKg}
                    onChange={(e) => {
                      const kg = parseFloat(e.target.value) || 0;
                      setBaseWeightKg(kg);
                      setBaseWeightLbs(parseFloat((kg / 0.45359237).toFixed(2)));
                    }}
                    className="w-full text-xs font-semibold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Exercise Option / Variant Specific Muscle Group concerned */}
              <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                    Variant Muscular Groups (Multi-options)
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Map separate exercise variants/options configured on this machine to different muscular groups.
                  </p>
                </div>

                {/* List of currently custom-defined variant-to-muscle mappings */}
                {Object.keys(variantCategories).length > 0 || computedMachineVariants.length > 0 ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {/* Unique union of standard log-variants + custom mappings */}
                    {Array.from(new Set([...computedMachineVariants, ...Object.keys(variantCategories)])).map((varName) => (
                      <div key={varName} className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-800 p-2.5 rounded-xl border border-gray-200 dark:border-slate-800/80">
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                          {varName}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <div className="w-[110px]">
                            <Dropdown
                              value={variantCategories[varName] || category}
                              onChange={(val) => {
                                setVariantCategories(prev => ({
                                  ...prev,
                                  [varName]: val
                                }));
                              }}
                              options={[
                                { value: category, label: `Machine Main (${category})` },
                                'Chest', 'Arms', 'Legs', 'Core', 'Back', 'Shoulders', 'Glutes'
                              ]}
                              buttonClassName="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700/80 text-[11px] font-bold py-1 px-1.5 rounded-lg text-gray-850 dark:text-white focus:outline-none cursor-pointer"
                              menuClassName="absolute z-50 w-32 mt-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto py-1 focus:outline-none right-0"
                            />
                          </div>
                          
                          {/* Remove custom variant mapping button */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...variantCategories };
                              delete updated[varName];
                              setVariantCategories(updated);
                            }}
                            className="text-red-500 hover:text-red-650 dark:hover:text-red-400 p-0.5"
                            title="Remove mapping"
                          >
                            <X size={14} className="stroke-[2.5px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-2 italic bg-gray-50 dark:bg-slate-800 rounded-xl">
                    No exercise variants added yet. Write one below to customize!
                  </p>
                )}

                {/* Sub-form to add a new option/variant with its muscular group */}
                <div className="flex gap-2 bg-gray-50 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Add custom variant (e.g. Single Arm)..."
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="w-full text-[11px] font-semibold py-1.5 px-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-white focus:outline-none placeholder:text-gray-400"
                    />
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <div className="w-[80px]">
                      <Dropdown
                        value={newVariantMuscle}
                        onChange={(val) => setNewVariantMuscle(val)}
                        options={['Chest', 'Arms', 'Legs', 'Core', 'Back', 'Shoulders', 'Glutes']}
                        buttonClassName="w-full flex items-center justify-between bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-[11px] font-bold py-1.5 px-1.5 rounded-lg text-gray-850 dark:text-white focus:outline-none cursor-pointer"
                        menuClassName="absolute z-50 w-28 mt-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-40 overflow-y-auto py-1 right-0"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newVariantName.trim()) return;
                        setVariantCategories(prev => ({
                          ...prev,
                          [newVariantName.trim()]: newVariantMuscle
                        }));
                        setNewVariantName('');
                      }}
                      className="bg-black dark:bg-white text-white dark:text-black p-1.5 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                      title="Add Variant Muscle override"
                    >
                      <Plus size={14} className="stroke-[3px]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Custom Fields Section */}
              <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    ⚙️ Custom Optional Fields
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Define custom specifications to track for this equipment (e.g. Seat Position, Backrest Angle, Handle Adjustment).
                  </p>
                </div>

                {customFieldsState.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {customFieldsState.map((fieldName) => (
                      <div key={fieldName} className="flex items-center gap-1 bg-amber-55 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-slate-800 text-xs font-bold animate-in zoom-in-95 duration-200">
                        <span>{fieldName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFieldsState(prev => prev.filter(f => f !== fieldName));
                          }}
                          className="text-amber-500 hover:text-red-500 p-0.5 transition-colors cursor-pointer"
                          title="Remove custom field"
                        >
                          <X size={12} className="stroke-[3px]" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-2.5 italic bg-gray-50 dark:bg-slate-800 rounded-xl">
                    No custom fields added yet. Perfect for gear adjustment settings!
                  </p>
                )}

                <div className="flex gap-2 bg-gray-50 dark:bg-slate-800/40 p-2 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="E.g. Seat Position, Backrest Incline..."
                    value={newCustomFieldName}
                    onChange={(e) => setNewCustomFieldName(e.target.value)}
                    className="flex-1 text-[11px] font-semibold py-1.5 px-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-white focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmed = newCustomFieldName.trim();
                        if (trimmed && !customFieldsState.includes(trimmed)) {
                          setCustomFieldsState(prev => [...prev, trimmed]);
                          setNewCustomFieldName('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newCustomFieldName.trim();
                      if (!trimmed) return;
                      if (customFieldsState.includes(trimmed)) return;
                      setCustomFieldsState(prev => [...prev, trimmed]);
                      setNewCustomFieldName('');
                    }}
                    className="bg-black dark:bg-white text-white dark:text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-850 dark:hover:bg-zinc-100 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} className="stroke-[3px]" /> Add
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMachine(null);
                    setIsCreatingNewMachine(false);
                  }}
                  className="flex-1 py-3 text-xs font-bold rounded-2xl bg-gray-150 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold rounded-2xl bg-amber-500 hover:bg-amber-600 text-white transition-all text-center shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} className="stroke-[3px]" /> {isCreatingNewMachine ? "Create Equipment" : "Save Characteristics"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
