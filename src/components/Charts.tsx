import React, { useMemo, useState, useRef, useEffect } from 'react';
import { WorkoutSet, MachineConfig } from '../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { MACHINES } from './MachineList';
import Dropdown from './Dropdown';
import { Dumbbell } from 'lucide-react';

export default function Charts({ 
  sets, 
  machineConfigs = [], 
  initialExercise,
  onNavigateToRegister
}: { 
  sets: WorkoutSet[], 
  machineConfigs?: MachineConfig[], 
  initialExercise?: string,
  onNavigateToRegister?: (exercise: string) => void
}) {
  const [selectedExercise, setSelectedExercise] = useState<string>(initialExercise && Array.from(new Set(sets.map(s => s.exercise))).includes(initialExercise) ? initialExercise : 'All');
  const [metric, setMetric] = useState<'max_weight' | 'volume'>('max_weight');

  const exercises = useMemo(() => Array.from(new Set(sets.map(s => s.exercise))), [sets]);

  useEffect(() => {
    if (initialExercise && exercises.includes(initialExercise)) {
      setSelectedExercise(initialExercise);
    }
  }, [initialExercise, exercises]);

  const lineChartData = useMemo(() => {
    const filtered = selectedExercise === 'All' 
        ? sets 
        : sets.filter(s => s.exercise === selectedExercise);

    const groupedByDateAndExercise = filtered.reduce((acc, set) => {
      const dateStr = format(set.date.toDate(), 'dd/MM/yyyy');
      const key = `${dateStr}_${set.exercise}`;
      
      if (!acc[key]) {
        acc[key] = {
           date: dateStr,
           dateObj: set.date.toDate(),
           exercise: set.exercise,
           maxWeight: 0,
           volume: 0,
           setsCount: 0
        };
      }
      
      if (set.weightLbs > acc[key].maxWeight) {
        acc[key].maxWeight = set.weightLbs;
      }
      acc[key].volume += (set.reps * set.weightLbs);
      acc[key].setsCount += 1;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedByDateAndExercise)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(item => ({
        name: item.date,
        [metric === 'max_weight' ? 'Max Weight (lbs)' : 'Volume (lbs)']: metric === 'max_weight' ? item.maxWeight : item.volume,
        setsCount: item.setsCount
      }));
  }, [selectedExercise, sets, metric]);

  const muscleGroupData = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const categoryVolume: Record<string, number> = {};
    
    // Fast O(1) category lookup map
    const categoryMap = new Map<string, string>();
    machineConfigs.forEach(c => {
      if (c.exercise && c.category) {
        categoryMap.set(c.exercise.toLowerCase(), c.category);
      }
    });
    MACHINES.forEach(m => {
      if (m.name && m.category && !categoryMap.has(m.name.toLowerCase())) {
        categoryMap.set(m.name.toLowerCase(), m.category);
      }
    });

    sets.forEach(s => {
      if (!s.date) return;
      const time = s.createdAt && s.createdAt.toMillis ? s.createdAt.toMillis() : (s.date.toMillis ? s.date.toMillis() : new Date(s.date as any).getTime());
      if (time > sevenDaysAgo) {
        const category = categoryMap.get(s.exercise.toLowerCase()) || 'Custom';
        categoryVolume[category] = (categoryVolume[category] || 0) + (s.reps * s.weightLbs);
      }
    });

    return Object.entries(categoryVolume)
      .map(([name, volume]) => ({ name, volume }))
      .sort((a, b) => b.volume - a.volume);
  }, [sets, machineConfigs]);

  if (sets.length === 0) {
    return <div className="text-center py-12 text-gray-500 dark:text-slate-400">No data for charts.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Dropdown
            value={selectedExercise}
            onChange={(val) => setSelectedExercise(val)}
            options={[
              { value: 'All', label: 'All Exercises (Combined View)' },
              ...exercises
            ]}
          />
        </div>

        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMetric('max_weight')}
            className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${metric === 'max_weight' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
          >
            Max Weight
          </button>
          <button
            onClick={() => setMetric('volume')}
            className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${metric === 'volume' ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-black dark:hover:text-white'}`}
          >
            Volume
          </button>
        </div>
      </div>

      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineChartData} margin={{ top: 20, right: 15, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} tickMargin={10} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
            <Tooltip 
               contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Line 
               type="monotone" 
               dataKey={metric === 'max_weight' ? 'Max Weight (lbs)' : 'Volume (lbs)'}
               stroke="#3b82f6" 
               strokeWidth={2}
               dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
               activeDot={{ r: 6 }}
               label={(props: any) => {
                 const { x, y, index } = props;
                 if (selectedExercise === 'All') return null;
                 const dataPoint = lineChartData[index];
                 if (!dataPoint || dataPoint.setsCount === undefined) return null;
                 return (
                   <text 
                     x={x} 
                     y={y - 12} 
                     className="text-[10px] font-bold fill-gray-600 dark:fill-slate-300"
                     textAnchor="middle"
                   >
                     Set : {dataPoint.setsCount}
                   </text>
                 );
               }}
            />
          </LineChart>
        </ResponsiveContainer>
       </div>

      {muscleGroupData.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Muscle Volume (Last 7 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={muscleGroupData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 600 }} width={80} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(156, 163, 175, 0.1)' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="volume" name="Volume (lbs)" radius={[0, 4, 4, 0]}>
                  {
                    muscleGroupData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#9CA3AF'} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {selectedExercise !== 'All' && onNavigateToRegister && (
        <div className="mt-6 pt-4 flex justify-center sm:justify-end border-t border-gray-100 dark:border-slate-800/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            id="btn-go-back-register-set"
            onClick={() => onNavigateToRegister(selectedExercise)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-5 py-2.5 rounded-xl font-bold text-xs border border-blue-200/50 dark:border-blue-900/40 shadow-sm transition-all hover:scale-[1.01] active:scale-99 cursor-pointer"
          >
            <Dumbbell size={15} strokeWidth={2.5} />
            <span>Go back to register set for {selectedExercise}</span>
          </button>
        </div>
      )}
    </div>
  );
}
