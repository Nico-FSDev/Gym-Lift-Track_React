import React, { useState, useEffect } from 'react';
import { Database, Wrench, ShieldAlert, ArrowLeft, User, ChevronRight, Edit2, Trash2, Calendar, HardDrive, Plus, Check, Loader2, Search, Terminal, Copy, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Play, Sparkles, Activity } from 'lucide-react';
import { collection, getDocs, doc, query, orderBy, where, updateDoc, deleteDoc, setDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { WorkoutSet, MachineConfig } from '../types';
import { format } from 'date-fns';
import { handleFirestoreError, OperationType } from '../utils/firebase-errors';
import DiagnosticConsole from './admin/DiagnosticConsole';
import AppConfigurationView from './admin/AppConfigurationView';
import GlobalConfiguratorTemplatesView from './admin/GlobalConfiguratorTemplatesView';
import CentralErrorPipelineView from './admin/CentralErrorPipelineView';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  lastActive?: any;
  isPremium?: boolean;
  isAdmin?: boolean;
}

type ViewState = 'menu' | 'profiles' | 'user_detail' | 'exercise_history' | 'premium_manager' | 'global_templates' | 'app_config' | 'error_pipeline';

export default function AdminView() {
  const [view, setView] = useState<ViewState>('menu');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedPremiumUser, setSelectedPremiumUser] = useState<UserProfile | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [userSets, setUserSets] = useState<WorkoutSet[]>([]);
  const [userConfigs, setUserConfigs] = useState<MachineConfig[]>([]);

  // Editing state for registered sets
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState<number>(10);
  const [editWeightLbs, setEditWeightLbs] = useState<number>(100);
  const [editDegrees, setEditDegrees] = useState<string>('');
  const [editVariant, setEditVariant] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');

  // Status message state
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (view === 'profiles' || view === 'premium_manager') {
      fetchProfiles();
    }
  }, [view]);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => {
      setStatusMsg(null);
    }, 4000);
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const results: UserProfile[] = snapshot.docs.map(docSnap => ({
        ...(docSnap.data() as UserProfile),
        uid: docSnap.id
      }));
      setProfiles(results);
    } catch (err) {
      console.error('Error fetching profiles:', err);
      showStatus('Failed to retrieve profiles.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const createDemoProfile = async () => {
    setIsLoading(true);
    try {
      const demoId = 'demo-user-' + Math.random().toString(36).slice(2, 6);
      const demoRef = doc(db, 'users', demoId);
      
      const names = ['Marc L.', 'Julie D.', 'Alexandre T.', 'Sophie M.', 'Kevin R.'];
      const chosenName = names[Math.floor(Math.random() * names.length)];
      
      await setDoc(demoRef, {
        uid: demoId,
        displayName: `${chosenName} (Demo Account)`,
        email: `athlete.${demoId}@example.com`,
        photoURL: '',
        lastActive: Timestamp.now()
      });
      
      // Seed some initial workout sets for this demo athlete to manage
      const timestampNow = Timestamp.now();
      const demoSets = [
        { exercise: 'Arm Curl', reps: 10, weightLbs: 60, weightKg: 27, date: timestampNow, userId: demoId },
        { exercise: 'Arm Curl', reps: 8, weightLbs: 70, weightKg: 31.5, date: timestampNow, userId: demoId },
        { exercise: 'Pec fly', reps: 10, weightLbs: 120, weightKg: 54, date: timestampNow, userId: demoId },
        { exercise: 'Rotary Torso', reps: 12, weightLbs: 90, weightKg: 40.5, degrees: 70, date: timestampNow, userId: demoId },
      ];

      for (const set of demoSets) {
        await addDoc(collection(db, 'users', demoId, 'workoutSets'), {
          ...set,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // And a machine config
      await setDoc(doc(db, 'users', demoId, 'machineConfigs', 'arm-curl-config'), {
        exercise: 'Arm Curl',
        baseWeightLbs: 5,
        baseWeightKg: 2.25,
        brand: 'Matrix',
        category: 'Arms',
        type: 'Machine',
        userId: demoId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      showStatus('Demonstration profile generated successfully !');
      await fetchProfiles();
    } catch (err) {
      console.error('Error creating demo profile:', err);
      showStatus('Failed to create demo profile.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProfile = async (profile: UserProfile) => {
    setSelectedProfile(profile);
    setIsLoading(true);
    try {
      await fetchUserProfileData(profile.uid);
      setView('user_detail');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfileData = async (profileId: string) => {
    // 1. Fetch workoutSets
    const setsQuery = query(collection(db, 'users', profileId, 'workoutSets'), orderBy('date', 'desc'));
    const setsSnap = await getDocs(setsQuery);
    const loadedSets = setsSnap.docs.map(docSnap => ({
      ...(docSnap.data() as WorkoutSet),
      id: docSnap.id
    }));
    setUserSets(loadedSets);

    // 2. Fetch machineConfigs
    const configsSnap = await getDocs(collection(db, 'users', profileId, 'machineConfigs'));
    const loadedConfigs = configsSnap.docs.map(docSnap => ({
      ...(docSnap.data() as MachineConfig),
      id: docSnap.id
    }));
    setUserConfigs(loadedConfigs);
  };

  const handleSelectExercise = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setView('exercise_history');
  };

  const startEditSet = (setItem: WorkoutSet) => {
    setEditingSetId(setItem.id || null);
    setEditReps(setItem.reps);
    setEditWeightLbs(setItem.weightLbs);
    setEditDegrees(setItem.degrees !== undefined ? String(setItem.degrees) : '');
    setEditVariant(setItem.variant || '');
    
    if (setItem.date) {
      const dateObj = (setItem.date as any).toDate ? (setItem.date as any).toDate() : new Date(setItem.date as any);
      setEditDate(format(dateObj, "yyyy-MM-dd'T'HH:mm"));
    } else {
      setEditDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleSaveSet = async (setId: string) => {
    if (!selectedProfile) return;
    try {
      const parsedReps = Number(editReps);
      const parsedWeightLbs = Number(editWeightLbs);
      const parsedWeightKg = Number((parsedWeightLbs * 0.45359237).toFixed(2));
      const parsedDegrees = editDegrees.trim() ? Number(editDegrees) : undefined;
      const parsedVariant = editVariant.trim() || undefined;
      const parsedDate = new Date(editDate);

      const updateData: any = {
        reps: parsedReps,
        weightLbs: parsedWeightLbs,
        weightKg: parsedWeightKg,
        date: Timestamp.fromDate(parsedDate),
        updatedAt: serverTimestamp()
      };

      if (parsedDegrees !== undefined) updateData.degrees = parsedDegrees;
      if (parsedVariant !== undefined) updateData.variant = parsedVariant;

      const docRef = doc(db, 'users', selectedProfile.uid, 'workoutSets', setId);
      await updateDoc(docRef, updateData);
      
      showStatus('Set history updated successfully !');
      setEditingSetId(null);
      // Reload user data
      await fetchUserProfileData(selectedProfile.uid);
    } catch (err) {
      console.error('Error saving edited set:', err);
      showStatus('Failed to update physical set.', 'error');
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!selectedProfile) return;
    if (!window.confirm('Are you absolutely sure you want to delete this set record from database?')) return;
    
    try {
      const docRef = doc(db, 'users', selectedProfile.uid, 'workoutSets', setId);
      await deleteDoc(docRef);
      showStatus('Exercise set deleted successfully.');
      await fetchUserProfileData(selectedProfile.uid);
    } catch (err) {
      console.error('Error deleting set:', err);
      showStatus('Failed to delete set record from Firestore database.', 'error');
    }
  };

  const handleAddBatchSet = async () => {
    if (!selectedProfile || !selectedExercise) return;
    try {
      const parsedWeightKg = Number((100 * 0.45359237).toFixed(2));
      const newSet: any = {
        exercise: selectedExercise,
        reps: 10,
        weightLbs: 100,
        weightKg: parsedWeightKg,
        date: Timestamp.fromDate(new Date()),
        userId: selectedProfile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'users', selectedProfile.uid, 'workoutSets'), newSet);
      showStatus('New default set registered in profile history.');
      await fetchUserProfileData(selectedProfile.uid);
    } catch (err) {
      console.error('Error registering set:', err);
      showStatus('Failed to register default set.', 'error');
    }
  };

  // Combine workoutSets with machineConfigs to calculate exercises
  const exercisesMap = new Map<string, {
    name: string;
    setsCount: number;
    config?: MachineConfig;
  }>();

  userSets.forEach(set => {
    if (!set.exercise) return;
    const current = exercisesMap.get(set.exercise) || { name: set.exercise, setsCount: 0, config: undefined };
    current.setsCount += 1;
    exercisesMap.set(set.exercise, current);
  });

  userConfigs.forEach(config => {
    if (!config.exercise) return;
    const current = exercisesMap.get(config.exercise) || { name: config.exercise, setsCount: 0, config: undefined };
    current.config = config;
    exercisesMap.set(config.exercise, current);
  });

  const exerciseList = Array.from(exercisesMap.values());

  const formatSetDate = (ts: any) => {
    if (!ts) return '';
    const dateObj = ts.toDate ? ts.toDate() : new Date(ts);
    return format(dateObj, 'dd/MM/yyyy HH:mm:ss');
  };

  // Filter profiles based on search
  const filteredProfiles = profiles.filter(p => 
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTogglePremium = async (targetUser: UserProfile) => {
    try {
      const newPremiumState = !targetUser.isPremium;
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { isPremium: newPremiumState });
      
      // Update local profiles list state
      setProfiles(prev => prev.map(p => p.uid === targetUser.uid ? { ...p, isPremium: newPremiumState } : p));
      
      // Update selected user state
      if (selectedPremiumUser && selectedPremiumUser.uid === targetUser.uid) {
        setSelectedPremiumUser({ ...selectedPremiumUser, isPremium: newPremiumState });
      }

      showStatus(`✓ ${targetUser.displayName}'s Premium access has been ${newPremiumState ? 'GRANTED' : 'REVOKED'}.`);
    } catch (err: any) {
      console.error(err);
      showStatus(`Failed to update premium status: ${err.message}`, 'error');
    }
  };

  const handleToggleAdmin = async (targetUser: UserProfile) => {
    try {
      const newAdminState = !targetUser.isAdmin;
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { isAdmin: newAdminState });
      
      // Update local profiles list state
      setProfiles(prev => prev.map(p => p.uid === targetUser.uid ? { ...p, isAdmin: newAdminState } : p));
      
      // Update selected user state
      if (selectedPremiumUser && selectedPremiumUser.uid === targetUser.uid) {
        setSelectedPremiumUser({ ...selectedPremiumUser, isAdmin: newAdminState });
      }

      showStatus(`✓ ${targetUser.displayName}'s Admin access has been ${newAdminState ? 'GRANTED' : 'REVOKED'}.`);
    } catch (err: any) {
      console.error(err);
      showStatus(`Failed to update admin status: ${err.message}`, 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex justify-between items-center px-1">
        <div className="flex gap-3 items-center text-red-650 dark:text-red-500">
           <ShieldAlert size={28} />
           <h2 className="text-2xl font-black text-gray-905 dark:text-white">Admin Dashboard</h2>
        </div>
        
        {view !== 'menu' && (
          <button 
            onClick={() => {
              if (['profiles', 'premium_manager', 'global_templates', 'app_config', 'error_pipeline'].includes(view)) setView('menu');
              else if (view === 'user_detail') setView('profiles');
              else if (view === 'exercise_history') setView('user_detail');
            }}
            className="flex items-center gap-1 text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 py-2 px-3 rounded-xl transition"
          >
            <ArrowLeft size={14} /> Back to Admin Menu
          </button>
        )}
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-center text-xs font-bold shadow-md animate-in fade-in duration-200 ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/50' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
        }`}>
          {statusMsg.text}
        </div>
      )}

      {/* VIEW: MAIN MENU */}
      {view === 'menu' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 flex flex-col gap-4">
          
          {/* Option: Central Error Pipeline Section */}
          <button 
            onClick={() => setView('error_pipeline')}
            className="p-5 border-2 border-rose-500 bg-rose-500/5 dark:bg-rose-950/10 rounded-2xl hover:bg-rose-500/10 transition-all flex flex-col gap-2 items-start text-left group"
          >
             <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-sm">
               <Activity size={20} />
             </div>
             <div className="flex items-center gap-2">
               <span className="font-bold text-gray-900 dark:text-white text-lg">Central Error Pipeline</span>
               <span className="text-[10px] uppercase font-black tracking-wider bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 px-2 py-0.5 rounded-full">
                 Audits & Bugs
               </span>
             </div>
             <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">
               Two dedicated hubs: <strong>Audit App</strong> (interactive test suites with per-part consoles & error copy buttons) and <strong>Bug Reports</strong> (view athlete bug logs & condition stacks).
             </span>
          </button>

          {/* Option: Global Configurator Templates */}
          <button 
            onClick={() => setView('global_templates')}
            className="p-5 border-2 border-indigo-500 bg-indigo-500/5 dark:bg-indigo-950/10 rounded-2xl hover:bg-indigo-500/10 transition-all flex flex-col gap-2 items-start text-left group"
          >
             <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
               <Database size={20} />
             </div>
             <div className="flex items-center gap-2">
               <span className="font-bold text-gray-900 dark:text-white text-lg">Global Configurator Templates</span>
               <span className="text-[10px] uppercase font-black tracking-wider bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                 Active
               </span>
             </div>
             <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">
               Add, edit, or customize default global machine templates, plate increments, and equipment baseline weights available to all athletes.
             </span>
          </button>

          {/* Option: App Configuration */}
          <button 
            onClick={() => setView('app_config')}
            className="p-5 border-2 border-slate-700 dark:border-slate-500 bg-slate-500/5 dark:bg-slate-800/20 rounded-2xl hover:bg-slate-500/10 transition-all flex flex-col gap-2 items-start text-left group"
          >
             <div className="w-10 h-10 rounded-full bg-slate-800 dark:bg-slate-700 flex items-center justify-center text-white shadow-sm">
               <Wrench size={20} />
             </div>
             <div className="flex items-center gap-2">
               <span className="font-bold text-gray-900 dark:text-white text-lg">App Configuration</span>
               <span className="text-[10px] uppercase font-black tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                 Config
               </span>
             </div>
             <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">
               Toggle dynamic feature flags (3D avatar, calorie calculations, rotary torso wheel), system broadcast banners, and manual cache maintenance.
             </span>
          </button>

          {/* Option: Manage Database by Selecting a Profile */}
          <button 
            onClick={() => setView('profiles')}
            className="p-5 border border-gray-200 dark:border-slate-800 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all flex flex-col gap-2 items-start text-left group"
          >
             <div className="w-10 h-10 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black">
               <User size={20} />
             </div>
             <span className="font-bold text-gray-900 dark:text-white text-lg">Manage Database by Profile</span>
             <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">Select a user profile, review and manage their logged machines and historical sets database.</span>
          </button>

          {/* Option: Manage Premium & Admin Access */}
          <button 
            onClick={() => setView('premium_manager')}
            className="p-5 border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 rounded-2xl hover:bg-amber-500/10 transition-all flex flex-col gap-2 items-start text-left group"
          >
             <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
               <Sparkles size={20} />
             </div>
             <span className="font-bold text-gray-900 dark:text-white text-lg font-sans">Premium Membership Manager</span>
             <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">Search the user database, list all accounts in a dropdown, and instantly grant or revoke free lifetime Premium access.</span>
          </button>
        </div>
      )}

      {/* VIEW: PROFILES */}
      {view === 'profiles' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-4">
          <div className="flex justify-between items-center pb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">User Profiles Database</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">Select any registered member profile to start managing.</p>
            </div>
            
            <button
              onClick={createDemoProfile}
              className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-705 text-gray-800 dark:text-slate-205 rounded-xl text-2xs font-extrabold shadow-2xs transition active:scale-95 flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={3} /> Demo Profile
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input 
              type="text"
              placeholder="Search profile by display name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold py-3 pl-10 pr-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={32} />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl space-y-3">
              <p className="text-xs text-gray-500 dark:text-slate-400 italic">No user profiles found.</p>
              <button 
                onClick={createDemoProfile}
                className="mx-auto text-xs font-bold bg-black dark:bg-white text-white dark:text-black py-2 px-4 rounded-xl shadow-md transition active:scale-95"
              >
                Provision Mock Athletes
              </button>
            </div>
          ) : (
            <div className="space-y-2 divide-y divide-gray-100 dark:divide-slate-800/50">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.uid}
                  onClick={() => handleSelectProfile(profile)}
                  className="w-full flex items-center justify-between p-3 first:pt-1 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-xl transition text-left"
                >
                  <div className="flex items-center gap-3">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 font-bold uppercase border border-gray-200 dark:border-slate-700">
                        {profile.displayName ? profile.displayName.slice(0, 2) : 'A'}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-gray-905 dark:text-white leading-tight">{profile.displayName}</h4>
                      <p className="text-2xs text-gray-500 font-mono select-all leading-relaxed">{profile.email}</p>
                      {profile.lastActive && (
                        <p className="text-[10px] text-gray-400">
                          Active: {formatSetDate(profile.lastActive)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight size={18} className="text-gray-400 dark:text-slate-500 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: PREMIUM MEMBER MANAGER */}
      {view === 'premium_manager' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-6">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="text-amber-500 fill-amber-500" size={18} />
              Premium Membership Access
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
              Grant lifetime Premium or Admin permissions to any registered member.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input 
              type="text"
              placeholder="Search by name, email or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold py-3 pl-10 pr-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Accounts Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-wider font-sans">
              Select Account Dropdown
            </label>
            <div className="relative">
              <select
                value={selectedPremiumUser?.uid || ''}
                onChange={(e) => {
                  const selectedUid = e.target.value;
                  const found = profiles.find(p => p.uid === selectedUid);
                  setSelectedPremiumUser(found || null);
                }}
                className="w-full text-xs font-bold py-3 px-4 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
              >
                <option value="">-- Choose an athlete account --</option>
                {filteredProfiles.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.displayName || 'No Name'} ({p.email}) {p.isPremium ? '★ PREMIUM' : ''} {p.isAdmin ? '⚙ ADMIN' : ''}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={24} />
            </div>
          )}

          {/* Active Card for Selected User */}
          {selectedPremiumUser && (
            <div className="p-5 bg-amber-500/5 border-2 border-amber-500/20 dark:border-amber-500/15 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedPremiumUser.photoURL ? (
                    <img src={selectedPremiumUser.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-605 dark:text-amber-400 font-extrabold flex items-center justify-center border border-amber-200 dark:border-amber-900/40 uppercase">
                      {selectedPremiumUser.displayName ? selectedPremiumUser.displayName.slice(0, 2) : 'A'}
                    </div>
                  )}
                  <div>
                    <h4 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">
                      {selectedPremiumUser.displayName || 'Unnamed User'}
                    </h4>
                    <p className="text-2xs text-gray-500 dark:text-slate-400 font-mono select-all leading-relaxed">
                      {selectedPremiumUser.email}
                    </p>
                    <p className="text-[9px] text-gray-400 dark:text-slate-500 font-mono mt-0.5 select-all">
                      UID: {selectedPremiumUser.uid}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 items-end">
                  {selectedPremiumUser.isPremium ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50">
                      <Sparkles size={10} className="fill-amber-500" /> Premium Elite
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200/50 dark:border-slate-700">
                      Free Member
                    </span>
                  )}

                  {selectedPremiumUser.isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200/50">
                      System Administrator
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => handleTogglePremium(selectedPremiumUser)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 ${
                    selectedPremiumUser.isPremium
                      ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/40'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-amber-500/10'
                  }`}
                >
                  {selectedPremiumUser.isPremium ? (
                    <>Revoke Premium Access</>
                  ) : (
                    <>
                      <Sparkles size={12} className="fill-white animate-pulse" /> Grant Premium (Free)
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleToggleAdmin(selectedPremiumUser)}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-extrabold transition active:scale-95 border ${
                    selectedPremiumUser.isAdmin
                      ? 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-900 dark:text-white border-gray-300 dark:border-slate-700'
                  }`}
                >
                  {selectedPremiumUser.isAdmin ? 'Revoke Admin Access' : 'Grant Admin Status'}
                </button>
              </div>
            </div>
          )}

          {/* Directory list of all accounts for ultra quick toggles */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-black uppercase text-gray-600 dark:text-slate-400 font-mono tracking-wider">
              System Directory & Quick Toggles
            </h4>
            
            <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 pr-1 space-y-1.5 scrollbar-thin">
              {filteredProfiles.map((p) => {
                const isSelected = selectedPremiumUser?.uid === p.uid;
                return (
                  <div
                    key={p.uid}
                    className={`flex items-center justify-between p-3 rounded-xl transition ${
                      isSelected 
                        ? 'bg-amber-500/10 border border-amber-400 dark:border-amber-800' 
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <button 
                      onClick={() => setSelectedPremiumUser(p)}
                      className="flex items-center gap-2.5 text-left min-w-0"
                    >
                      {p.photoURL ? (
                        <img src={p.photoURL} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-400 text-xs font-bold shrink-0">
                          {p.displayName ? p.displayName.slice(0, 2) : 'A'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-gray-900 dark:text-white block truncate leading-tight">
                          {p.displayName || 'No Name'}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate block font-mono">
                          {p.email}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Premium Button Indicator */}
                      <button
                        onClick={() => handleTogglePremium(p)}
                        className={`px-2 py-1 rounded-md text-[9px] font-black tracking-wide uppercase transition ${
                          p.isPremium 
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200' 
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title={p.isPremium ? "Revoke Premium" : "Grant Premium"}
                      >
                        Premium
                      </button>

                      {/* Admin Indicator */}
                      <button
                        onClick={() => handleToggleAdmin(p)}
                        className={`px-2 py-1 rounded-md text-[9px] font-black tracking-wide uppercase transition ${
                          p.isAdmin 
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-200' 
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title={p.isAdmin ? "Revoke Admin" : "Grant Admin"}
                      >
                        Admin
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: USER PROFILE DETAILS */}
      {view === 'user_detail' && selectedProfile && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-slate-800/60">
            {selectedProfile.photoURL ? (
              <img src={selectedProfile.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 font-bold uppercase border border-gray-200 dark:border-slate-700">
                {selectedProfile.displayName.slice(0, 2)}
              </div>
            )}
            <div>
              <span className="text-[9px] font-mono tracking-widest text-red-500 uppercase">Database Profile</span>
              <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">{selectedProfile.displayName}</h3>
              <p className="text-2xs text-gray-500 font-mono leading-relaxed">{selectedProfile.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-black uppercase text-gray-700 dark:text-slate-400 font-mono tracking-wide">
                Configured Exercises / Machines DB
              </h4>
              <p className="text-[11px] text-gray-500">Pick any machine or free activity to review logged set records.</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={24} />
              </div>
            ) : exerciseList.length === 0 ? (
              <p className="text-sm text-center py-8 text-gray-500 italic">No machines or exercises recorded yet for this athlete.</p>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                {exerciseList.map((exercise) => (
                  <button
                    key={exercise.name}
                    onClick={() => handleSelectExercise(exercise.name)}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl border border-gray-200 dark:border-slate-800/50 transition cursor-pointer text-left"
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-gray-900 dark:text-white">
                        {exercise.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {exercise.config ? (
                          <span className="inline-flex py-0.5 px-2 bg-amber-50 dark:bg-amber-950/30 text-[10px] font-bold text-amber-700 dark:text-amber-400 rounded-md">
                            {exercise.config.brand || 'Standard'} • {exercise.config.category || 'Arms'} ({exercise.config.type || 'Machine'})
                          </span>
                        ) : (
                          <span className="inline-flex py-0.5 px-2 bg-gray-200 dark:bg-slate-800 text-[10px] font-medium text-gray-600 dark:text-slate-400 rounded-md">
                            Generic Template
                          </span>
                        )}
                        <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase font-mono">
                          {exercise.setsCount} Set(s)
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 dark:text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: EXERCISE HISTORY */}
      {view === 'exercise_history' && selectedProfile && selectedExercise && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-5">
          <div className="flex justify-between items-start pb-3 border-b border-gray-100 dark:border-slate-800/60">
            <div>
              <span className="text-[9px] font-mono tracking-widest text-blue-600 dark:text-blue-400 uppercase">
                History of: {selectedProfile.displayName}
              </span>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">{selectedExercise}</h3>
            </div>
            
            <button
              onClick={handleAddBatchSet}
              className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-850 dark:hover:bg-gray-100 text-2xs font-extrabold rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1"
            >
              <Plus size={12} strokeWidth={3} /> Add Set
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={24} />
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {userSets
                  .filter(set => set.exercise.toLowerCase() === selectedExercise.toLowerCase())
                  .map((setItem) => {
                    const isEditing = editingSetId === setItem.id;
                    return (
                      <div 
                        key={setItem.id} 
                        className={`p-4 rounded-2xl border transition ${
                          isEditing 
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-md shadow-amber-500/5' 
                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-800/80'
                        }`}
                      >
                        {isEditing ? (
                          /* EDIT SUB-FORM */
                          <div className="space-y-3 animate-in fade-in duration-200">
                            <span className="text-[10px] font-bold text-amber-600 uppercase font-mono tracking-wider">
                              Editing Set Record
                            </span>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-505">Reps</label>
                                <input
                                  type="number"
                                  value={editReps}
                                  onChange={(e) => setEditReps(Number(e.target.value))}
                                  className="w-full text-xs font-bold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-505">Weight (lbs)</label>
                                <input
                                  type="number"
                                  value={editWeightLbs}
                                  onChange={(e) => setEditWeightLbs(Number(e.target.value))}
                                  className="w-full text-xs font-bold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-505">Degrees (optional)</label>
                                <input
                                  type="number"
                                  placeholder="None"
                                  value={editDegrees}
                                  onChange={(e) => setEditDegrees(e.target.value)}
                                  className="w-full text-xs font-semibold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-505">Variant option</label>
                                <input
                                  type="text"
                                  placeholder="None"
                                  value={editVariant}
                                  onChange={(e) => setEditVariant(e.target.value)}
                                  className="w-full text-xs font-semibold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg focus:outline-none"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-505">Date & Time</label>
                              <input
                                type="datetime-local"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="w-full text-xs font-semibold py-1.5 px-2.5 bg-white dark:bg-slate-800 border border-gray-200 rounded-lg focus:outline-none"
                              />
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => setEditingSetId(null)}
                                className="flex-1 text-2xs font-bold py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveSet(setItem.id!)}
                                className="flex-1 text-2xs font-bold py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 flex items-center justify-center gap-1 shadow-sm"
                              >
                                <Check size={12} strokeWidth={3} /> Save Set
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* READ DISPLAY */
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-sm text-gray-905 dark:text-white">
                                  {setItem.reps} Reps
                                </span>
                                <span className="text-sm font-bold text-gray-500 dark:text-slate-400">
                                  @ {setItem.weightLbs} lbs ({setItem.weightKg} kg)
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                                  <Calendar size={10} /> {formatSetDate(setItem.date)}
                                </span>
                                {setItem.degrees !== undefined && (
                                  <span className="inline-block py-0.2 px-1 rounded bg-orange-50 dark:bg-orange-950/20 text-[9px] font-bold text-orange-600 dark:text-orange-450">
                                    {setItem.degrees}°
                                  </span>
                                )}
                                {setItem.variant && (
                                  <span className="inline-block py-0.2 px-1 rounded bg-blue-50 dark:bg-blue-950/20 text-[9px] font-bold text-blue-600 dark:text-blue-450">
                                    {setItem.variant}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1">
                              <button
                                onClick={() => startEditSet(setItem)}
                                className="p-2 rounded-xl text-gray-400 dark:text-slate-505 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white transition"
                                title="Edit this set"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteSet(setItem.id!)}
                                className="p-2 rounded-xl text-gray-405 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition"
                                title="Delete this set"
                              >
                                <Trash2 size={13} />
                              </button>
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

      {/* VIEW: GLOBAL CONFIGURATOR TEMPLATES */}
      {view === 'global_templates' && (
        <GlobalConfiguratorTemplatesView />
      )}

      {/* VIEW: APP CONFIGURATION */}
      {view === 'app_config' && (
        <AppConfigurationView />
      )}

      {/* VIEW: CENTRAL ERROR PIPELINE (Audit App & Bug Reports) */}
      {view === 'error_pipeline' && (
        <CentralErrorPipelineView />
      )}

      {/* Persistent global error and diagnostic live console */}
      <DiagnosticConsole />
    </div>
  );
}
