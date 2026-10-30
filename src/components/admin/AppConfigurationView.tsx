import React, { useState, useEffect } from 'react';
import { Wrench, Shield, Save, RotateCcw, Trash2, CheckCircle, AlertTriangle, Info, Bell, ToggleLeft, ToggleRight, Sparkles, Database, Loader2, Zap, Clock } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { purgeExpiredErrorLogs } from '../../utils/sessionManager';

export interface AppConfigState {
  features: {
    avatar3d: boolean;
    calorieCalculator: boolean;
    csvImporter: boolean;
    degreePicker: boolean;
    soundEffects: boolean;
    fatigueScoring: boolean;
    demoDataSeed: boolean;
  };
  announcement: {
    enabled: boolean;
    message: string;
    type: 'info' | 'warning' | 'success';
  };
  defaults: {
    defaultWeightUnit: 'lbs' | 'kg';
    defaultRestSeconds: number;
    autoPurgeErrorDays: number;
  };
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_APP_CONFIG: AppConfigState = {
  features: {
    avatar3d: true,
    calorieCalculator: true,
    csvImporter: true,
    degreePicker: true,
    soundEffects: true,
    fatigueScoring: true,
    demoDataSeed: true,
  },
  announcement: {
    enabled: false,
    message: 'Welcome to Gym Lift Track! All cloud services are operational.',
    type: 'info',
  },
  defaults: {
    defaultWeightUnit: 'lbs',
    defaultRestSeconds: 90,
    autoPurgeErrorDays: 7,
  },
};

export default function AppConfigurationView() {
  const [config, setConfig] = useState<AppConfigState>(DEFAULT_APP_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [purgedCount, setPurgedCount] = useState<number | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      // 1. Try local storage cache first for instantaneous rendering
      const localCached = localStorage.getItem('gym_app_config');
      if (localCached) {
        try {
          setConfig(JSON.parse(localCached));
        } catch {
          // ignore corrupted local json
        }
      }

      // 2. Fetch from Firestore
      const docRef = doc(db, 'appConfig', 'general');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const cloudData = snap.data() as AppConfigState;
        setConfig({
          ...DEFAULT_APP_CONFIG,
          ...cloudData,
          features: { ...DEFAULT_APP_CONFIG.features, ...(cloudData.features || {}) },
          announcement: { ...DEFAULT_APP_CONFIG.announcement, ...(cloudData.announcement || {}) },
          defaults: { ...DEFAULT_APP_CONFIG.defaults, ...(cloudData.defaults || {}) },
        });
        localStorage.setItem('gym_app_config', JSON.stringify(cloudData));
      }
    } catch (err: any) {
      console.error('Failed to load app config from cloud:', err);
      // Fallback to local
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'appConfig', 'general');
      const payload: AppConfigState = {
        ...config,
        updatedAt: Timestamp.now(),
        updatedBy: auth.currentUser?.email || 'admin',
      };
      await setDoc(docRef, payload, { merge: true });
      localStorage.setItem('gym_app_config', JSON.stringify(payload));
      showStatus('Application Configuration synchronized successfully to Firebase!');
    } catch (err: any) {
      console.error('Error saving app config:', err);
      showStatus(`Failed to update configuration: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!window.confirm('Reset all feature flags and configurations to factory defaults?')) return;
    setConfig(DEFAULT_APP_CONFIG);
    showStatus('Reset to defaults in local form. Click "Save Changes" to commit to cloud.');
  };

  const handleClearTransientCaches = () => {
    try {
      // Keep only essentials (auth keys)
      const keysToKeep = ['gym_lift_track_session_id', 'gym_lift_track_session_start'];
      const allKeys = Object.keys(localStorage);
      let cleared = 0;
      allKeys.forEach((k) => {
        if (!keysToKeep.includes(k) && !k.startsWith('firebase:authUser')) {
          localStorage.removeItem(k);
          cleared++;
        }
      });
      showStatus(`Transient browser caches cleared (${cleared} keys purged).`);
    } catch (err: any) {
      showStatus('Failed to clear transient caches.', 'error');
    }
  };

  const handlePurgeTelemetryNow = async () => {
    setIsPurging(true);
    try {
      const count = await purgeExpiredErrorLogs();
      setPurgedCount(count);
      showStatus(`Telemetry cleanup complete: ${count} expired error logs older than 7 days were removed.`);
    } catch {
      showStatus('Error running telemetry cleanup.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

  const toggleFeature = (key: keyof AppConfigState['features']) => {
    setConfig((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800/80 space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <Wrench size={22} />
            <span className="text-[10px] font-mono tracking-widest uppercase font-black">System Administration</span>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
            App Configuration & Feature Flags
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Control dynamic app behaviors, active feature toggles, announcements, and maintenance utilities.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetToDefaults}
            className="px-3 py-2 text-xs font-bold text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-extrabold text-white bg-black dark:bg-white dark:text-black hover:opacity-90 rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Changes
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

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400 dark:text-slate-500" size={32} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Section 1: Feature Flags */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Zap size={16} className="text-amber-500" />
                  Dynamic Feature Flags
                </h4>
                <p className="text-[11px] text-gray-500">Toggle core user modules in real-time across the app.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 3D Avatar */}
              <div
                onClick={() => toggleFeature('avatar3d')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">3D Anatomical Avatar</span>
                  <span className="text-[10px] text-gray-500 block">Interactive Three.js visual body model</span>
                </div>
                {config.features.avatar3d ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* Calorie Calculator */}
              <div
                onClick={() => toggleFeature('calorieCalculator')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">Metabolic Calorie Engine</span>
                  <span className="text-[10px] text-gray-500 block">Calculates energy & metabolic expenditures</span>
                </div>
                {config.features.calorieCalculator ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* CSV Importer */}
              <div
                onClick={() => toggleFeature('csvImporter')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">Sheets & CSV Importer</span>
                  <span className="text-[10px] text-gray-500 block">Allows direct Google Sheet / CSV workout import</span>
                </div>
                {config.features.csvImporter ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* Degree Wheel Picker */}
              <div
                onClick={() => toggleFeature('degreePicker')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">Degree Wheel Picker</span>
                  <span className="text-[10px] text-gray-500 block">Radial degrees selection for rotary machines</span>
                </div>
                {config.features.degreePicker ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* Fatigue Scoring */}
              <div
                onClick={() => toggleFeature('fatigueScoring')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">Fatigue & Recovery Scoring</span>
                  <span className="text-[10px] text-gray-500 block">RPE-based muscle recovery indicators</span>
                </div>
                {config.features.fatigueScoring ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* Sound & Haptic Feedback */}
              <div
                onClick={() => toggleFeature('soundEffects')}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800/70 transition"
              >
                <div>
                  <span className="font-bold text-xs text-gray-900 dark:text-white block">Haptic & Audio Feedback</span>
                  <span className="text-[10px] text-gray-500 block">Vibration and sound confirmation upon set logged</span>
                </div>
                {config.features.soundEffects ? (
                  <ToggleRight size={26} className="text-emerald-500 shrink-0" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400 shrink-0" />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Global Announcement Banner */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <Bell size={16} className="text-blue-500" />
                  System Announcement Banner
                </h4>
                <p className="text-[11px] text-gray-500">Display a global notification or maintenance banner to all athletes.</p>
              </div>

              <div
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    announcement: { ...prev.announcement, enabled: !prev.announcement.enabled },
                  }))
                }
                className="cursor-pointer"
              >
                {config.announcement.enabled ? (
                  <ToggleRight size={26} className="text-blue-500" />
                ) : (
                  <ToggleLeft size={26} className="text-gray-400" />
                )}
              </div>
            </div>

            {config.announcement.enabled && (
              <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-2xl animate-in fade-in duration-200">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Banner Message
                  </label>
                  <input
                    type="text"
                    value={config.announcement.message}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        announcement: { ...prev.announcement, message: e.target.value },
                      }))
                    }
                    placeholder="e.g. Scheduled server maintenance tonight from 02:00 to 03:00 UTC."
                    className="w-full text-xs font-semibold py-2 px-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase font-mono">
                    Style:
                  </label>
                  {(['info', 'warning', 'success'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          announcement: { ...prev.announcement, type: t },
                        }))
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                        config.announcement.type === t
                          ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: App Defaults & Metric Units */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock size={16} className="text-purple-500" />
              Default Application Metrics & Rest Timers
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-800 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                  Default Weight Display
                </label>
                <select
                  value={config.defaults.defaultWeightUnit}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      defaults: { ...prev.defaults, defaultWeightUnit: e.target.value as 'lbs' | 'kg' },
                    }))
                  }
                  className="w-full text-xs font-bold py-1.5 px-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="lbs">Pounds (lbs)</option>
                  <option value="kg">Kilograms (kg)</option>
                </select>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-800 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                  Default Rest Timer (Seconds)
                </label>
                <input
                  type="number"
                  value={config.defaults.defaultRestSeconds}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      defaults: { ...prev.defaults, defaultRestSeconds: Number(e.target.value) },
                    }))
                  }
                  className="w-full text-xs font-bold py-1.5 px-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Maintenance & Transient Cache Utilities */}
          <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-slate-800/80">
            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <Database size={16} className="text-rose-500" />
              Storage, Telemetry & Cache Maintenance
            </h4>
            <p className="text-[11px] text-gray-500">
              Clear transient browser caches or run on-demand database telemetry maintenance.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Clear transient caches */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <span className="font-bold text-xs text-gray-900 dark:text-white block">
                  Browser Transient Caches
                </span>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Purges local calculation caches and temporary preferences without signing out.
                </p>
                <button
                  onClick={handleClearTransientCaches}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={12} /> Clear Browser Caches
                </button>
              </div>

              {/* 7-day TTL Error Telemetry Purge */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-800 space-y-2">
                <span className="font-bold text-xs text-gray-900 dark:text-white block">
                  7-Day Error Telemetry TTL
                </span>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  All error session logs automatically expire after 7 days. Click to trigger immediate manual pruning.
                </p>
                <button
                  onClick={handlePurgeTelemetryNow}
                  disabled={isPurging}
                  className="w-full py-2 px-3 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-xs font-bold rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isPurging ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Purge Expired Logs (&gt; 7 Days)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
