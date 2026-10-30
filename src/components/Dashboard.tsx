import React, { useState, useEffect } from 'react';
import { useWorkoutSets } from '../hooks/useWorkoutSets';
import { useAuth } from '../hooks/useAuth';
import { backButtonManager } from '../utils/backButtonManager';
import BodybuildingView from './BodybuildingView';
import BodyShapeView from './BodyShapeView';
import CaloriesCalculatorView from './CaloriesCalculatorView';
import ChartsView from './ChartsView';
import SettingsView from './SettingsView';
import UserView from './UserView';
import AdminView from './AdminView';
import BottomNav from './BottomNav';
import CsvImporter from './CsvImporter';
import Logo from './Logo';
import CreditTrackerBadge from './CreditTrackerBadge';
import { FileSpreadsheet, Sparkles, Settings, Shield, User } from 'lucide-react';

export default function Dashboard() {
  const { user, dbUser } = useAuth();
  const { sets, machineConfigs, loading, addSet, updateSet, deleteSet, saveMachineConfig, saveMachineConfigsBatch, seedData, importCSV, repairFlippedDates, applyPresetsToExistingMachines } = useWorkoutSets();
  const [activeTab, setActiveTab] = useState('bodybuilding');
  const [targetChartExercise, setTargetChartExercise] = useState<string | undefined>(undefined);
  const [targetRegisterExercise, setTargetRegisterExercise] = useState<string | undefined>(undefined);
  const [showDirectImporter, setShowDirectImporter] = useState(false);
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({
    bodybuilding: 0,
    bodyShape: 0,
    calories: 0,
    charts: 0,
    settings: 0,
    user: 0,
    admin: 0,
  });

  const photoURL = dbUser?.photoURL || user?.photoURL;
  const avatarInitial = (dbUser?.displayName || user?.displayName || user?.email || '')
    .charAt(0)
    .toUpperCase();
  const isAdmin = dbUser?.isAdmin || user?.email === 'n.lohberger.pro@gmail.com' || user?.email === 'lohbergerscholar@gmail.com';

  const handleTabChange = (tabId: string, exercise?: string) => {
    if (tabId === 'charts') {
      setTargetChartExercise(exercise);
    }
    if (tabId === 'bodybuilding') {
      setTargetRegisterExercise(exercise);
    }
    
    if (activeTab === tabId) {
      setResetKeys((prev) => ({
        ...prev,
        [tabId]: prev[tabId] + 1,
      }));
    } else {
      setActiveTab(tabId);
    }
  };

  // Hardware Back Button integration via backButtonManager
  useEffect(() => {
    if (showDirectImporter) {
      return backButtonManager.register('dashboard-importer', 100, () => {
        setShowDirectImporter(false);
        return true;
      });
    }
    if (activeTab !== 'bodybuilding') {
      return backButtonManager.register('dashboard-tab-navigation', 20, () => {
        setActiveTab('bodybuilding');
        return true;
      });
    }
  }, [showDirectImporter, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
         <div className="w-10 h-10 border-4 border-gray-200 dark:border-slate-800 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Sticky Top Header Navigation */}
      <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-40 transition-all shadow-2xs dark:shadow-none mb-6 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto h-16 flex items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <button
            type="button"
            onClick={() => handleTabChange('bodybuilding')}
            className="flex items-center gap-2.5 text-left group transition-transform active:scale-95 cursor-pointer"
            title="Accueil / Lift"
          >
            <Logo size={32} className="w-8 h-8 rounded-lg group-hover:scale-105 transition-transform" />
            <span className="text-base sm:text-lg font-black tracking-wider text-black dark:text-white uppercase transition-colors">
              Gym Lift Track
            </span>
          </button>

          {/* Top Right Controls Area */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Credit Tracker Badge */}
            <CreditTrackerBadge onNavigateToTab={handleTabChange} />

            {/* Admin Menu Icon (Left of Settings Icon) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleTabChange('admin')}
                className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                  activeTab === 'admin'
                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 shadow-2xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 border-transparent'
                }`}
                title="Admin Menu"
              >
                <Shield size={20} strokeWidth={activeTab === 'admin' ? 2.5 : 2} />
              </button>
            )}

            {/* Settings Menu Icon (Left of Profile Avatar Icon) */}
            <button
              type="button"
              onClick={() => handleTabChange('settings')}
              className={`p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                activeTab === 'settings'
                  ? 'bg-gray-100 dark:bg-slate-800 text-black dark:text-white border-gray-300 dark:border-slate-700 shadow-2xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 border-transparent'
              }`}
              title="Settings"
            >
              <Settings size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
            </button>

            {/* Profile Avatar Icon (Rightmost) */}
            <button
              type="button"
              onClick={() => handleTabChange('user')}
              className="relative group p-0.5 rounded-full transition-all cursor-pointer focus:outline-hidden"
              title="Profile"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Profile"
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover transition-all ${
                    activeTab === 'user'
                      ? 'ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 shadow-2xs'
                      : 'ring-1 ring-gray-200 dark:ring-slate-700 hover:ring-gray-400 dark:hover:ring-slate-500'
                  }`}
                />
              ) : (
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                    activeTab === 'user'
                      ? 'bg-black text-white dark:bg-white dark:text-black font-extrabold ring-2 ring-black dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 shadow-2xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {avatarInitial ? (
                    <span className="text-xs sm:text-sm font-black uppercase">{avatarInitial}</span>
                  ) : (
                    <User size={18} />
                  )}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      <main 
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 sm:pb-32"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {sets.length === 0 && activeTab === 'bodybuilding' && (
          <div className="space-y-6 mb-8 animate-in fade-in duration-300">
            {!showDirectImporter ? (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xs border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 transition-colors duration-300">
                <div className="space-y-2 text-center md:text-left">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 text-2xs font-extrabold uppercase tracking-wide rounded-full">
                    <Sparkles size={12} /> Nouveau format de Google Sheet pris en charge
                  </span>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">Bienvenue dans Gym Lift Track !</h3>
                  <p className="text-gray-500 dark:text-slate-400 text-sm font-medium leading-relaxed max-w-lg">
                    Votre base de données est vide. Choisissez d'importer directement votre fichier d'entraînement Google Sheets ou de charger des données de démonstration.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                  <button
                    onClick={seedData}
                    className="px-6 py-4 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white text-sm font-bold rounded-xl transition-all active:scale-95 w-full sm:w-auto shadow-2xs border border-gray-100 dark:border-slate-700"
                  >
                    Données de démo
                  </button>
                  <button
                    onClick={() => setShowDirectImporter(true)}
                    className="px-6 py-4 bg-black dark:bg-white text-white dark:text-black text-sm font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all active:scale-95 w-full sm:w-auto shadow-2xs flex items-center justify-center gap-2"
                  >
                    <FileSpreadsheet size={16} />
                    Importer Google Sheet
                  </button>
                </div>
              </div>
            ) : (
              <CsvImporter 
                onImport={importCSV} 
                onClose={() => setShowDirectImporter(false)} 
              />
            )}
          </div>
        )}

        <div className="animate-in fade-in duration-500">
          {activeTab === 'bodybuilding' && (
            <div key={`bodybuilding-${resetKeys.bodybuilding}`} className="w-full">
              <BodybuildingView 
                addSet={addSet} 
                updateSet={updateSet}
                deleteSet={deleteSet}
                onSuccess={(exercise) => {
                  setTargetChartExercise(exercise);
                  setActiveTab('charts');
                }} 
                sets={sets} 
                machineConfigs={machineConfigs}
                saveMachineConfig={saveMachineConfig}
                initialExercise={targetRegisterExercise}
                onNavigateToTab={handleTabChange}
              />
            </div>
          )}
          {activeTab === 'bodyShape' && (
            <div key={`bodyShape-${resetKeys.bodyShape}`} className="w-full">
              <BodyShapeView 
                sets={sets} 
                machineConfigs={machineConfigs}
                onNavigateToTab={handleTabChange} 
                onNavigateToRegister={(exercise) => {
                  setTargetRegisterExercise(exercise);
                  setActiveTab('bodybuilding');
                }}
              />
            </div>
          )}
          {activeTab === 'calories' && (
            <div key={`calories-${resetKeys.calories}`} className="w-full">
              <CaloriesCalculatorView sets={sets} onNavigateToTab={handleTabChange} />
            </div>
          )}
          {activeTab === 'charts' && (
            <div key={`charts-${resetKeys.charts}`} className="w-full">
              <ChartsView 
                sets={sets} 
                machineConfigs={machineConfigs}
                updateSet={updateSet}
                deleteSet={deleteSet}
                initialExercise={targetChartExercise}
                onNavigateToRegister={(exercise) => {
                  setTargetRegisterExercise(exercise);
                  setActiveTab('bodybuilding');
                }}
                onNavigateToTab={handleTabChange}
              />
            </div>
          )}
          {activeTab === 'settings' && (
            <div key={`settings-${resetKeys.settings}`} className="w-full">
              <SettingsView 
                importCSV={importCSV}
                setsCount={sets.length}
                onWipeAll={async () => {
                  // wipe all sets for this user
                  for (const s of sets) {
                    if (s.id) await deleteSet(s.id);
                  }
                }}
                repairFlippedDates={repairFlippedDates}
                applyPresetsToExistingMachines={applyPresetsToExistingMachines}
                machineConfigs={machineConfigs}
                sets={sets}
                saveMachineConfig={saveMachineConfig}
                saveMachineConfigsBatch={saveMachineConfigsBatch}
              />
            </div>
          )}
          {activeTab === 'user' && (
            <div key={`user-${resetKeys.user}`} className="w-full">
              <UserView />
            </div>
          )}
          {activeTab === 'admin' && (
            <div key={`admin-${resetKeys.admin}`} className="w-full">
              <AdminView />
            </div>
          )}
        </div>
      </main>

      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
    </div>
  );
}
