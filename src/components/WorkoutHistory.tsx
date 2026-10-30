import React, { useState } from 'react';
import { WorkoutSet } from '../types';
import { format } from 'date-fns';
import { Edit2, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface WorkoutHistoryProps {
  sets: WorkoutSet[];
  updateSet?: (id: string, data: any) => Promise<void>;
  deleteSet?: (id: string) => Promise<void>;
}

export default function WorkoutHistory({ sets, updateSet, deleteSet }: WorkoutHistoryProps) {
  const [editingSet, setEditingSet] = useState<WorkoutSet | null>(null);
  
  // Local edit states
  const [editExercise, setEditExercise] = useState('');
  const [editVariant, setEditVariant] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editWeightLbs, setEditWeightLbs] = useState('');
  const [editDegrees, setEditDegrees] = useState('');
  const [editDate, setEditDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  if (sets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-slate-400">
        No sets logged yet.
      </div>
    );
  }

  // Group by date, then by exercise
  const groupedByDate = sets.reduce((acc, set) => {
    const jsDate = set.date.toDate();
    // Normalize date to prevent time-of-day shifting groups
    const normalizedDate = new Date(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate());
    const dateStr = format(normalizedDate, 'PPP');
    
    if (!acc[dateStr]) {
      acc[dateStr] = { 
        timestamp: normalizedDate.getTime(), 
        exercises: {} 
      };
    }
    
    const exercise = set.exercise || 'Unknown Exercise';
    if (!acc[dateStr].exercises[exercise]) {
      acc[dateStr].exercises[exercise] = [];
    }
    acc[dateStr].exercises[exercise].push(set);
    
    return acc;
  }, {} as Record<string, { timestamp: number, exercises: Record<string, WorkoutSet[]> }>);

  // Sort dates descending
  const sortedDates = Object.entries(groupedByDate)
    .sort((a, b) => b[1].timestamp - a[1].timestamp);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const startEditing = (set: WorkoutSet) => {
    setEditingSet(set);
    setShowDeleteConfirm(false);
    setEditExercise(set.exercise || '');
    setEditVariant(set.variant || '');
    setEditReps(String(set.reps || ''));
    setEditWeightLbs(String(set.weightLbs || ''));
    setEditDegrees(set.degrees !== undefined ? String(set.degrees) : '');

    const jsDate = set.date.toDate();
    const yyyy = jsDate.getFullYear();
    const mm = String(jsDate.getMonth() + 1).padStart(2, '0');
    const dd = String(jsDate.getDate()).padStart(2, '0');
    setEditDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSave = async () => {
    if (!editingSet || !editingSet.id || !updateSet) return;
    if (!editExercise.trim() || !editReps || !editWeightLbs || !editDate) return;

    setIsSubmitting(true);
    try {
      const repCount = parseInt(editReps);
      const weightLbsVal = parseFloat(editWeightLbs);
      const weightKgVal = weightLbsVal * 0.453592237;

      const [y, m, d] = editDate.split('-').map(Number);
      const originalDate = editingSet.date.toDate();
      const updatedDate = new Date(y, m - 1, d, originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());

      const updatedFields: any = {
        exercise: editExercise.trim(),
        reps: repCount,
        weightLbs: Math.round(weightLbsVal * 100) / 100,
        weightKg: Math.round(weightKgVal * 100) / 100,
        variant: editVariant.trim() || null,
        degrees: editDegrees ? parseFloat(editDegrees) : null,
        date: Timestamp.fromDate(updatedDate),
      };

      // clean the fields
      if (updatedFields.variant === null) delete updatedFields.variant;
      if (updatedFields.degrees === null) delete updatedFields.degrees;

      await updateSet(editingSet.id, updatedFields);
      setEditingSet(null);
    } catch (err) {
      console.error('Failed to update set:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingSet || !editingSet.id || !deleteSet) return;
    
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteSet(editingSet.id);
      setEditingSet(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to delete set:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {sortedDates.map(([dateStr, { exercises }]) => (
        <div key={dateStr} className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-800 pb-2">
            {dateStr}
          </h3>
          <div className="space-y-3">
            {Object.entries(exercises).map(([exercise, groupSets]) => {
              const groupKey = `${dateStr}-${exercise}`;
              const isExpanded = expandedGroups[groupKey];
              // Sort the sets inside this exercise group by time descending
              const sortedSets = [...groupSets].sort((a, b) => b.date.toMillis() - a.date.toMillis());

              return (
                <div key={groupKey} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-200">
                  <button 
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-slate-400">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{exercise}</h4>
                        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 font-medium">{sortedSets.length} {sortedSets.length === 1 ? 'set' : 'sets'}</div>
                      </div>
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="overflow-x-auto border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/30">
                      <table className="w-full text-sm text-left text-gray-600 dark:text-slate-300 border-collapse">
                        <thead className="text-xs text-gray-500 dark:text-slate-400 uppercase bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                          <tr>
                            <th className="px-4 py-3 font-medium whitespace-nowrap">Time</th>
                            <th className="px-4 py-3 font-medium text-right">Reps</th>
                            <th className="px-4 py-3 font-medium text-right">Weight</th>
                            <th className="px-4 py-3 font-medium text-right">Notes</th>
                            {updateSet && deleteSet && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSets.map((set) => (
                            <tr key={set.id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 transition-colors last:border-b-0">
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                <div className="text-sm font-bold">{format(set.date.toDate(), 'h:mm a')}</div>
                                
                                {(set.variant || set.posture) && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {set.variant && (
                                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded-sm inline-block">
                                        {set.variant}
                                      </span>
                                    )}
                                    {set.posture && (
                                      <span className="text-[10px] font-bold text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/20 px-1.5 py-0.5 rounded-sm inline-block">
                                        {set.posture} {set.weightModifier ? `(${set.weightModifier}%)` : ''}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">{set.reps}</td>
                              <td className="px-4 py-3 text-right">{set.weightLbs.toFixed(1)} lbs</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-1 font-medium text-xs">
                                  {set.degrees !== undefined && set.degrees !== null && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border whitespace-nowrap ${
                                      Number(set.degrees) > 0
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                        : Number(set.degrees) < 0
                                        ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                                        : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700'
                                    }`}>
                                      {Number(set.degrees) > 0 ? `+${set.degrees}° (Left)` : Number(set.degrees) < 0 ? `${set.degrees}° (Right)` : `0° (Center)`}
                                    </span>
                                  )}
                                  {set.customFields && Object.entries(set.customFields).map(([key, val]) => (
                                    <span key={key} className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200/30 dark:border-slate-800 whitespace-nowrap">
                                      {key}: {val}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              {updateSet && deleteSet && (
                                <td className="px-4 py-3 text-right">
                                  <button 
                                    onClick={() => startEditing(set)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                                    title="Edit or change retrospectively"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Editing Dialog Modal */}
      {editingSet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Recorded Set</h3>
              <button 
                onClick={() => setEditingSet(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Exercise/Machine</label>
                <input
                  type="text"
                  required
                  value={editExercise}
                  onChange={(e) => setEditExercise(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Sub-Exercise Variant <span className="text-gray-400 dark:text-slate-500 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={editVariant}
                  onChange={(e) => setEditVariant(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                  placeholder="e.g. Left pivot, right axis, chest fly"
                />
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 pl-1">
                  Specify different exercises we can do with a machine retrospectively.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Reps</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editReps}
                    onChange={(e) => setEditReps(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Weight (lbs)</label>
                  <input
                    type="number"
                    required
                    step="0.1"
                    value={editWeightLbs}
                    onChange={(e) => setEditWeightLbs(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Degrees (Optional)</label>
                <input
                  type="number"
                  value={editDegrees}
                  onChange={(e) => setEditDegrees(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                  placeholder="e.g. 70"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">Workout Date</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm font-medium text-black dark:text-white outline-none"
                />
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 p-3.5 rounded-2xl text-xs font-semibold leading-relaxed border border-red-100 dark:border-red-900/10 animate-in fade-in slide-in-from-top-1">
                ⚠️ Are you sure you want to permanently delete this logged workout set? This action cannot be undone.
              </div>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button
                onClick={handleDelete}
                type="button"
                disabled={isSubmitting}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                  showDeleteConfirm 
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' 
                    : 'border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                }`}
              >
                <Trash2 size={16} /> {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingSet(null)}
                  type="button"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  type="button"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-all shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
