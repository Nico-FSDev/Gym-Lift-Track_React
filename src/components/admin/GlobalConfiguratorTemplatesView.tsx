import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Edit2, Trash2, Check, X, RotateCcw, Building2, Dumbbell, Cpu, Clock, Loader2, Sparkles, Filter } from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { MACHINES } from '../MachineList';

export interface GlobalTemplateItem {
  id: string;
  name: string;
  category: string;
  type: 'Machine' | 'Weightlifting' | 'Exercise';
  brand: string;
  baseWeightLbs: number;
  baseWeightKg: number;
  restSeconds: number;
  createdAt?: any;
  updatedAt?: any;
}

const DEFAULT_GLOBAL_TEMPLATES: Omit<GlobalTemplateItem, 'id'>[] = [
  { name: 'Arm Curl', category: 'Arms', type: 'Machine', brand: 'Matrix', baseWeightLbs: 10, baseWeightKg: 4.5, restSeconds: 90 },
  { name: 'Abdominal', category: 'Core', type: 'Machine', brand: 'Matrix', baseWeightLbs: 10, baseWeightKg: 4.5, restSeconds: 90 },
  { name: 'Pec fly', category: 'Chest', type: 'Machine', brand: 'Matrix', baseWeightLbs: 15, baseWeightKg: 6.8, restSeconds: 120 },
  { name: 'Rotary Torso', category: 'Core', type: 'Machine', brand: 'Technogym', baseWeightLbs: 10, baseWeightKg: 4.5, restSeconds: 90 },
  { name: 'Perfect Squat', category: 'Legs', type: 'Machine', brand: 'Hammer Strength', baseWeightLbs: 45, baseWeightKg: 20.4, restSeconds: 180 },
  { name: 'Glute Trainer', category: 'Legs', type: 'Machine', brand: 'Life Fitness', baseWeightLbs: 20, baseWeightKg: 9.1, restSeconds: 150 },
  { name: 'Lat Pulldown', category: 'Back', type: 'Machine', brand: 'Matrix', baseWeightLbs: 15, baseWeightKg: 6.8, restSeconds: 120 },
  { name: 'Leg Press', category: 'Legs', type: 'Machine', brand: 'Hammer Strength', baseWeightLbs: 90, baseWeightKg: 40.8, restSeconds: 180 },
  { name: 'Shoulder Press', category: 'Shoulders', type: 'Machine', brand: 'Matrix', baseWeightLbs: 15, baseWeightKg: 6.8, restSeconds: 90 },
  { name: 'Cable Row', category: 'Back', type: 'Machine', brand: 'Technogym', baseWeightLbs: 15, baseWeightKg: 6.8, restSeconds: 90 },
  { name: 'Leg Extension', category: 'Legs', type: 'Machine', brand: 'Life Fitness', baseWeightLbs: 10, baseWeightKg: 4.5, restSeconds: 90 },
  { name: 'Leg Curl', category: 'Legs', type: 'Machine', brand: 'Life Fitness', baseWeightLbs: 10, baseWeightKg: 4.5, restSeconds: 90 },
  { name: 'Dumbbell Curl', category: 'Arms', type: 'Exercise', brand: 'Standard', baseWeightLbs: 0, baseWeightKg: 0, restSeconds: 90 },
  { name: 'Barbell Bench Press', category: 'Chest', type: 'Weightlifting', brand: 'Eleiko', baseWeightLbs: 45, baseWeightKg: 20.4, restSeconds: 150 },
  { name: 'Barbell Squat', category: 'Legs', type: 'Weightlifting', brand: 'Eleiko', baseWeightLbs: 45, baseWeightKg: 20.4, restSeconds: 180 },
  { name: 'Pull-up', category: 'Back', type: 'Exercise', brand: 'Bodyweight', baseWeightLbs: 0, baseWeightKg: 0, restSeconds: 120 },
  { name: 'Lateral Raise', category: 'Shoulders', type: 'Exercise', brand: 'Standard', baseWeightLbs: 0, baseWeightKg: 0, restSeconds: 90 },
  { name: 'Plank', category: 'Core', type: 'Exercise', brand: 'Bodyweight', baseWeightLbs: 0, baseWeightKg: 0, restSeconds: 60 },
];

const CATEGORIES = ['All', 'Arms', 'Chest', 'Back', 'Legs', 'Shoulders', 'Core'];

export default function GlobalConfiguratorTemplatesView() {
  const [templates, setTemplates] = useState<GlobalTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal / Editing form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Arms');
  const [formType, setFormType] = useState<'Machine' | 'Weightlifting' | 'Exercise'>('Machine');
  const [formBrand, setFormBrand] = useState('Matrix');
  const [formBaseWeightLbs, setFormBaseWeightLbs] = useState(10);
  const [formRestSeconds, setFormRestSeconds] = useState(90);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'globalMachineTemplates'));
      if (snap.empty) {
        // If empty, seed initial templates automatically
        await seedDefaultTemplates(false);
        return;
      }
      const loaded: GlobalTemplateItem[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<GlobalTemplateItem, 'id'>),
      }));
      setTemplates(loaded);
    } catch (err: any) {
      console.error('Error fetching global templates:', err);
      showStatus('Failed to load global templates from cloud.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const seedDefaultTemplates = async (manualNotice = true) => {
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const createdList: GlobalTemplateItem[] = [];

      for (const item of DEFAULT_GLOBAL_TEMPLATES) {
        const id = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const docRef = doc(db, 'globalMachineTemplates', id);
        const data = {
          ...item,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        batch.set(docRef, data, { merge: true });
        createdList.push({ id, ...data });
      }

      await batch.commit();
      setTemplates(createdList);
      if (manualNotice) {
        showStatus('Default machine templates catalog successfully restored & seeded!');
      }
    } catch (err: any) {
      console.error('Error seeding default templates:', err);
      showStatus('Failed to seed default templates.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormCategory('Arms');
    setFormType('Machine');
    setFormBrand('Matrix');
    setFormBaseWeightLbs(10);
    setFormRestSeconds(90);
    setIsFormOpen(true);
  };

  const openEditModal = (item: GlobalTemplateItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormCategory(item.category || 'Arms');
    setFormType(item.type || 'Machine');
    setFormBrand(item.brand || 'Standard');
    setFormBaseWeightLbs(item.baseWeightLbs || 0);
    setFormRestSeconds(item.restSeconds || 90);
    setIsFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showStatus('Please specify a machine or exercise name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const baseWeightKg = Number((formBaseWeightLbs * 0.45359237).toFixed(2));
      const targetId = editingId || formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const docRef = doc(db, 'globalMachineTemplates', targetId);

      const payload = {
        name: formName.trim(),
        category: formCategory,
        type: formType,
        brand: formBrand.trim() || 'Standard',
        baseWeightLbs: Number(formBaseWeightLbs),
        baseWeightKg,
        restSeconds: Number(formRestSeconds),
        updatedAt: Timestamp.now(),
        ...(!editingId ? { createdAt: Timestamp.now() } : {}),
      };

      await setDoc(docRef, payload, { merge: true });
      showStatus(`Template "${formName}" successfully saved!`);
      setIsFormOpen(false);
      await fetchTemplates();
    } catch (err: any) {
      console.error('Error saving template:', err);
      showStatus(`Failed to save template: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (template: GlobalTemplateItem) => {
    if (!window.confirm(`Are you sure you want to remove template "${template.name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'globalMachineTemplates', template.id));
      showStatus(`Template "${template.name}" deleted.`);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err: any) {
      console.error('Error deleting template:', err);
      showStatus('Failed to delete template.', 'error');
    }
  };

  // Filter list
  const filtered = templates.filter((t) => {
    const matchesCat = selectedCategory === 'All' || t.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Database size={22} />
            <span className="text-[10px] font-mono tracking-widest uppercase font-black">Global Architecture</span>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
            Global Configurator Templates
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Add, customize, and manage standard equipment baseline templates available to all gym athletes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => seedDefaultTemplates(true)}
            className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5"
            title="Reset to factory catalog"
          >
            <RotateCcw size={13} /> Reset Catalog
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-extrabold text-white bg-black dark:bg-white dark:text-black hover:opacity-90 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={14} strokeWidth={3} /> Add Template
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-center text-xs font-bold shadow-xs animate-in fade-in duration-200 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-200/50'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200/50'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Search & Category Filter Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates by machine name, brand or muscle group..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold py-3 pl-10 pr-4 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-2xs font-extrabold transition shrink-0 ${
                selectedCategory === cat
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Template Cards Feed */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl space-y-2">
          <p className="text-xs text-gray-500 italic">No machine templates match your filters.</p>
          <button
            onClick={() => {
              setSelectedCategory('All');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 hover:border-gray-300 dark:hover:border-slate-700 transition flex flex-col justify-between gap-3 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-sm text-gray-900 dark:text-white block leading-tight">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {item.brand || 'Generic'} • {item.category}
                    </span>
                  </div>

                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      item.type === 'Machine'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/50'
                        : item.type === 'Weightlifting'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50'
                        : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/50'
                    }`}
                  >
                    {item.type}
                  </span>
                </div>

                <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-gray-600 dark:text-slate-400 font-mono">
                  <span>
                    Base: <b className="text-gray-900 dark:text-white font-bold">{item.baseWeightLbs} lbs</b> ({item.baseWeightKg} kg)
                  </span>
                  <span>•</span>
                  <span>Rest: {item.restSeconds}s</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-gray-200 dark:border-slate-800/80">
                <button
                  onClick={() => openEditModal(item)}
                  className="p-1.5 text-gray-500 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition"
                  title="Edit Template"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => handleDeleteTemplate(item)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
                  title="Delete Template"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add / Edit Template */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
              <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
                {editingId ? 'Edit Global Template' : 'Add New Global Template'}
              </h4>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                  Machine / Exercise Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Incline Chest Press"
                  className="w-full text-xs font-bold py-2.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs font-bold py-2 px-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full text-xs font-bold py-2 px-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white"
                  >
                    <option value="Machine">Machine</option>
                    <option value="Weightlifting">Weightlifting</option>
                    <option value="Exercise">Exercise</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Brand / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="Matrix, Hammer Strength..."
                    className="w-full text-xs font-bold py-2 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Base Weight (lbs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formBaseWeightLbs}
                    onChange={(e) => setFormBaseWeightLbs(Number(e.target.value))}
                    className="w-full text-xs font-bold py-2 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                  Default Rest Seconds
                </label>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={formRestSeconds}
                  onChange={(e) => setFormRestSeconds(Number(e.target.value))}
                  className="w-full text-xs font-bold py-2 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 text-xs font-extrabold bg-black dark:bg-white text-white dark:text-black rounded-xl hover:opacity-90 shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
