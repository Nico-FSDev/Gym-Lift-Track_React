import React, { useState } from 'react';
import Charts from './Charts';
import WorkoutHistory from './WorkoutHistory';
import GainProfile from './GainProfile';
import { BarChart2, History, TrendingUp } from 'lucide-react';
import { WorkoutSet, MachineConfig } from '../types';

export default function ChartsView({ 
  sets,
  machineConfigs,
  updateSet,
  deleteSet,
  initialExercise,
  onNavigateToRegister,
  onNavigateToTab
}: { 
  sets: WorkoutSet[];
  machineConfigs?: MachineConfig[];
  updateSet: (id: string, data: any) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  initialExercise?: string;
  onNavigateToRegister?: (exercise: string) => void;
  onNavigateToTab?: (tabId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'charts' | 'history' | 'profile'>('charts');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1.5 rounded-2xl max-w-md mx-auto shadow-inner overflow-x-auto">
        <button
          onClick={() => setActiveTab('charts')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'charts' ? 'bg-white dark:bg-slate-900 shadow-md text-black dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}
        >
          <BarChart2 size={16} /> Charts
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white dark:bg-slate-900 shadow-md text-black dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}
        >
          <History size={16} /> History
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-white dark:bg-slate-900 shadow-md text-black dark:text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white'}`}
        >
          <TrendingUp size={16} /> Gain Profile
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300 transition-colors">
        {activeTab === 'charts' && (
          <Charts 
            sets={sets} 
            machineConfigs={machineConfigs} 
            initialExercise={initialExercise} 
            onNavigateToRegister={onNavigateToRegister}
          />
        )}
        {activeTab === 'history' && <WorkoutHistory sets={sets} updateSet={updateSet} deleteSet={deleteSet} />}
        {activeTab === 'profile' && <GainProfile sets={sets} onNavigateToTab={onNavigateToTab} />}
      </div>
    </div>
  );
}
