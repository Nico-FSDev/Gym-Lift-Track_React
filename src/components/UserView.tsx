import React, { useState, useEffect } from 'react';
import { useAuth, getCreditResetCountdown } from '../hooks/useAuth';
import { logout } from '../firebase';
import { apiFetch } from '../utils/api';
import { 
  User, 
  LogOut, 
  Settings as SettingsIcon, 
  ChevronRight, 
  Scale, 
  ArrowLeft, 
  Check, 
  Plus, 
  Trash2, 
  UserPlus, 
  Lock, 
  Camera, 
  Eye, 
  EyeOff,
  UserCheck,
  Sparkles,
  Cpu,
  Loader2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Search,
  Dumbbell
} from 'lucide-react';
import { MeasurementProfile } from '../types';
import { CancelSubscriptionModal } from './CancelSubscriptionModal';
import { AVATAR_PRESETS, AVATAR_CATEGORIES, AvatarPreset } from '../data/avatarPresets';

export default function UserView() {
  const { 
    dbUser, 
    updateAccountDetails, 
    updateProfiles, 
    updateActiveProfileMeasurement,
    saveGeminiApiKey,
    setPremiumStatus
  } = useAuth();
  
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState(dbUser?.displayName || '');
  const [password, setPassword] = useState(dbUser?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Avatar selector state
  const [isAvatarExpanded, setIsAvatarExpanded] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState<string>('all');
  const [avatarSearchQuery, setAvatarSearchQuery] = useState('');

  // Premium / API key settings states
  const [apiKeyInput, setApiKeyInput] = useState(dbUser?.geminiApiKey || window.localStorage.getItem("custom_gemini_api_key") || '');
  const [keySaving, setKeySaving] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  useEffect(() => {
    if (dbUser?.geminiApiKey) {
      setApiKeyInput(dbUser.geminiApiKey);
      window.localStorage.setItem("custom_gemini_api_key", dbUser.geminiApiKey);
    }
  }, [dbUser?.geminiApiKey]);

  const isPremium = !!dbUser?.isPremium || !!window.localStorage.getItem("custom_gemini_api_key");

  // Sync state with dbUser when settings view is entered
  const enterSettings = () => {
    if (dbUser) {
      setDisplayName(dbUser.displayName);
      setPassword(dbUser.password || '');
    }
    setShowSettings(true);
    setSaveSuccess(null);
  };

  const handleSaveAccountDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateAccountDetails({
        displayName,
        password,
      });
      setSaveSuccess('Account settings saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save account details.');
    }
  };

  const handleSelectAvatar = async (url: string) => {
    try {
      await updateAccountDetails({ photoURL: url });
      setSaveSuccess('Avatar updated!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim() || !dbUser?.profiles) return;

    const newProfile: MeasurementProfile = {
      id: 'profile-' + Date.now(),
      name: newProfileName.trim(),
      height: 170,
      bodyWeight: 70,
      boneMass: 3,
      bodyFat: 15,
      arms: 35,
      chest: 100,
      waist: 80,
      thighs: 55,
      calves: 35,
      neck: 38,
      shoulders: 110,
    };

    const updatedProfiles = [...dbUser.profiles, newProfile];
    try {
      await updateProfiles(updatedProfiles, newProfile.id);
      setNewProfileName('');
      setSaveSuccess(`Profile "${newProfile.name}" added!`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!dbUser?.profiles) return;
    const profileToDelete = dbUser.profiles.find(p => p.id === profileId);
    if (!profileToDelete) return;

    if (confirm(`Are you sure you want to delete profile "${profileToDelete.name}"?`)) {
      const updatedProfiles = dbUser.profiles.filter(p => p.id !== profileId);
      const isDeletingActive = dbUser.activeProfileId === profileId;
      const nextActiveId = isDeletingActive ? 'default' : dbUser.activeProfileId;
      
      try {
        await updateProfiles(updatedProfiles, nextActiveId);
        setSaveSuccess('Profile deleted.');
        setTimeout(() => setSaveSuccess(null), 3000);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    if (!dbUser?.profiles) return;
    try {
      await updateProfiles(dbUser.profiles, profileId);
      setSaveSuccess(`Switched active profile!`);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Find active profile
  const activeProfile = dbUser?.profiles?.find(p => p.id === (dbUser.activeProfileId || 'default')) || dbUser?.profiles?.[0];
  const activeWeight = activeProfile?.bodyWeight ?? 70;

  if (showSettings) {
    return (
      <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
        {/* Back Button / Header */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(false)}
            className="p-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Settings</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Manage account info and profiles</p>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-sm font-bold flex items-center gap-2">
            <Check size={18} />
            {saveSuccess}
          </div>
        )}

        {/* Avatar Setup */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <Camera size={18} className="text-violet-500" />
              Choose Avatar Image
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900/40">
              {AVATAR_PRESETS.length} Avatars
            </span>
          </div>
          
          {/* Active Avatar Preview */}
          {(() => {
            const activePreset = AVATAR_PRESETS.find(p => p.url === dbUser?.photoURL);
            return (
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative group">
                  {dbUser?.photoURL ? (
                    <img 
                      src={dbUser.photoURL} 
                      alt="Avatar Preview" 
                      className="w-20 h-20 rounded-full border-4 border-violet-100 dark:border-slate-800 shadow-md object-cover" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Athletic';
                      }}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 border-4 border-violet-100 dark:border-slate-800">
                      <User size={36} />
                    </div>
                  )}
                  {dbUser?.photoURL && (
                    <div className="absolute bottom-0 right-0 bg-violet-600 text-white p-1 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-900">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  )}
                </div>

                {activePreset ? (
                  <div className="mt-2 text-center">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {activePreset.name}
                    </p>
                    <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">
                      {activePreset.categoryLabel}{activePreset.ethnicity ? ` • ${activePreset.ethnicity}` : ''}
                    </p>
                  </div>
                ) : dbUser?.photoURL ? (
                  <p className="mt-2 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                    Custom Registered Avatar
                  </p>
                ) : null}
              </div>
            );
          })()}

          {/* Avatars List / Grid */}
          {!isAvatarExpanded ? (
            /* Collapsed view: Exactly 6 avatars matching original density */
            <div className="space-y-2.5">
              <div className="grid grid-cols-6 gap-2">
                {AVATAR_PRESETS.slice(0, 6).map((opt) => (
                  <button 
                    key={opt.id}
                    id={`avatar-collapsed-${opt.id}`}
                    type="button"
                    onClick={() => handleSelectAvatar(opt.url)}
                    className={`relative p-1 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer aspect-square ${
                      dbUser?.photoURL === opt.url 
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-500/40 shadow-xs' 
                        : 'border-transparent bg-gray-50 dark:bg-slate-800'
                    }`}
                    title={`${opt.name} (${opt.categoryLabel})`}
                  >
                    <img 
                      src={opt.url} 
                      alt={opt.name} 
                      className="w-full h-full object-cover rounded-lg" 
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(opt.name)}`;
                      }}
                    />
                    {dbUser?.photoURL === opt.url && (
                      <div className="absolute top-1 right-1 bg-violet-600 text-white p-0.5 rounded-full shadow-2xs">
                        <Check size={9} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Expand Toggle Button */}
              <button
                id="btn-expand-avatar-presets"
                type="button"
                onClick={() => setIsAvatarExpanded(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-violet-200/80 dark:border-slate-700 bg-violet-50/60 hover:bg-violet-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <span>View All 46 Avatars (Bodybuilding, Combat & Olympic)</span>
                <ChevronDown size={15} />
              </button>
            </div>
          ) : (
            /* Expanded view: Categories, Search, Full Grid & Collapse Button */
            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
              {/* Category Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {AVATAR_CATEGORIES.map(cat => {
                  const count = cat.id === 'all'
                    ? AVATAR_PRESETS.length
                    : AVATAR_PRESETS.filter(p => p.category === cat.id).length;
                  const isSelected = avatarCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAvatarCategory(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by sport, ethnicity, or style (e.g. Karate, Judo, African, Asian, Olympic)..."
                  value={avatarSearchQuery}
                  onChange={(e) => setAvatarSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-1 focus:ring-violet-400"
                />
                {avatarSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAvatarSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Avatars Grid */}
              {(() => {
                const filtered = AVATAR_PRESETS.filter(opt => {
                  if (avatarCategory !== 'all' && opt.category !== avatarCategory) return false;
                  if (avatarSearchQuery.trim()) {
                    const q = avatarSearchQuery.toLowerCase();
                    return (
                      opt.name.toLowerCase().includes(q) ||
                      (opt.discipline && opt.discipline.toLowerCase().includes(q)) ||
                      (opt.ethnicity && opt.ethnicity.toLowerCase().includes(q)) ||
                      opt.categoryLabel.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">
                      No avatars found matching "{avatarSearchQuery}".
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto pr-1">
                    {filtered.map((opt) => (
                      <button
                        key={opt.id}
                        id={`avatar-opt-${opt.id}`}
                        type="button"
                        onClick={() => handleSelectAvatar(opt.url)}
                        className={`group relative p-1 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer flex flex-col items-center text-left ${
                          dbUser?.photoURL === opt.url
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-2 ring-violet-500/40 shadow-xs'
                            : 'border-transparent bg-gray-50 dark:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700'
                        }`}
                        title={`${opt.name} (${opt.categoryLabel}${opt.ethnicity ? ' - ' + opt.ethnicity : ''})`}
                      >
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800">
                          <img
                            src={opt.url}
                            alt={opt.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(opt.name)}`;
                            }}
                          />
                          {dbUser?.photoURL === opt.url && (
                            <div className="absolute top-1 right-1 bg-violet-600 text-white p-0.5 rounded-full shadow-2xs">
                              <Check size={9} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <div className="mt-1 w-full px-0.5 text-center">
                          <span className="block text-[10px] font-semibold text-gray-800 dark:text-slate-200 truncate">
                            {opt.name}
                          </span>
                          {opt.ethnicity && (
                            <span className="block text-[8px] font-bold text-violet-500 dark:text-violet-400 uppercase tracking-wider">
                              {opt.ethnicity}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Collapse Button */}
              <button
                id="btn-collapse-avatar-presets"
                type="button"
                onClick={() => setIsAvatarExpanded(false)}
                className="w-full py-2 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Collapse Avatars (Show 6)</span>
                <ChevronUp size={15} />
              </button>
            </div>
          )}

          {/* Custom Image URL */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <label className="block text-2xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Custom Image URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="https://example.com/my-image.png"
                value={customAvatarUrl}
                onChange={e => setCustomAvatarUrl(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-violet-300 outline-none"
              />
              <button 
                onClick={() => {
                  if (customAvatarUrl.trim()) {
                    handleSelectAvatar(customAvatarUrl.trim());
                    setCustomAvatarUrl('');
                  }
                }}
                className="px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-100 cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Account Details Form */}
        <form onSubmit={handleSaveAccountDetails} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <User size={18} className="text-violet-500" />
            Account Details
          </h3>

          <div>
            <label className="block text-2xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Account Display Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Jean Dupont"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-2xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Account Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-3xs text-gray-400 mt-1">Simulates local/cloud password integration with the account details.</p>
          </div>

          <button 
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white py-3.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.01]"
          >
            Save Account Settings
          </button>
        </form>

        {/* Premium Upgrade & Status Options */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-6 transition-colors">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Sparkles size={24} />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Gym Lift Track Premium</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {isPremium 
                  ? "✓ Elite Lifetime Access is active on this account." 
                  : "Unlock cutting-edge AI-powered lift coaches & automated exercises scans."}
              </p>
              
              {isPremium ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-2">
                  <Check size={14} className="stroke-[3px]" /> Active (Premium Unlocked)
                </span>
              ) : (
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                      Free Tier Mode
                    </span>
                    <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400">
                      ⚡ {Math.max(0, 5 - (dbUser?.premiumUses ?? 0))}/5 credits left
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
                    Weekly reset in <span className="font-bold text-gray-900 dark:text-white">{getCreditResetCountdown(dbUser?.premiumUsesResetAt).formatted}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Unlocked features checklist */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 font-mono">Premium Elite Benefits</h4>
            <ul className="space-y-2 text-xs text-gray-600 dark:text-slate-300 font-semibold">
              <li className="flex items-center gap-2">
                <span className="text-emerald-550">✓</span> Unlimited AI Biomechanical Coaching Recommendations (Volume, Strength, Speed, Endurance modes).
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-550">✓</span> Unlimited Gemini-powered automatic muscle target scanners.
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-550">✓</span> High-fidelity muscular and biomechanical data indexing.
              </li>
            </ul>
          </div>

          {/* If Premium active, show Manage / Cancel Subscription option */}
          {isPremium && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-2xs font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono">
                  Stripe Membership Status
                </span>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                  {dbUser?.hasRetentionDiscount ? '20% Off Retention Rate Active' : 'Premium Elite Billing Active'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <ShieldAlert size={14} />
                <span>Cancel Subscription</span>
              </button>
            </div>
          )}

          {!isPremium && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
              <div className="text-center space-y-1">
                <span className="text-2xs font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono">Elite Package</span>
                <p className="text-2xl font-black text-gray-900 dark:text-white">$9.99 <span className="text-xs font-medium text-gray-500">/ lifetime</span></p>
              </div>

              {dbUser?.isAdmin && (
                <div className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                    👑 Administrator Account Detected
                  </p>
                  <p className="text-2xs text-amber-700/80 dark:text-amber-400/80">
                    As an administrator, you have full override authorization to instantly claim Elite Premium access for free in the database.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await setPremiumStatus(true);
                        alert("🎉 Admin Override Successful! Premium has been unlocked permanently in the database.");
                      } catch (error: any) {
                        alert("Failed to grant admin premium: " + error.message);
                      }
                    }}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                  >
                    Activate Free Premium (Admin Bypass)
                  </button>
                </div>
              )}

              <button
                onClick={async () => {
                  if (stripeLoading) return;
                  setStripeLoading(true);
                  try {
                    const res = await apiFetch("/api/stripe/create-checkout-session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: dbUser?.email || "anonymous@gymtrack.io",
                        userId: dbUser?.uid || "anonymous_user",
                        appUrl: window.location.origin
                      })
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else if (data.isSimulated) {
                      await setPremiumStatus(true);
                      alert(`💳 Simulated Stripe Checkout Success!\n\nSince Stripe credentials are not present in this workspace environment, we simulated a successful billing transaction. Lifetime Premium has been unlocked on your user record in Firestore!`);
                    } else {
                      throw new Error(data.error || "Failed to initiate Stripe billing");
                    }
                  } catch (error: any) {
                    alert("Upgrade Error: " + error.message);
                  } finally {
                    setStripeLoading(false);
                  }
                }}
                disabled={stripeLoading}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:scale-[1.01] active:scale-[0.99] text-white font-bold rounded-2xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 text-sm"
              >
                {stripeLoading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                <span>Upgrade to Premium ($9.99)</span>
              </button>
            </div>
          )}
        </div>

        {/* Bring Your Own Gemini API Key Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-4 transition-colors">
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 text-base">
              <Cpu size={18} className="text-amber-500" /> Bring Your Own API Key (Optional)
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
              You can configure a personal Google Gemini API Key. Providing your own key automatically bypasses server constraints, runs analysis directly through your quota, and grants lifetime Premium access!
            </p>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              placeholder="Paste your Gemini API key here (AI_... or AIza...)"
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setKeySaveMessage(null);
              }}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
            />
            
            {keySaveMessage && (
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                {keySaveMessage}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const trimmed = apiKeyInput.trim();
                  if (!trimmed) return;
                  setKeySaving(true);
                  setKeySaveMessage(null);
                  try {
                    window.localStorage.setItem("custom_gemini_api_key", trimmed);
                    if (saveGeminiApiKey) {
                      await saveGeminiApiKey(trimmed);
                    }
                    setKeySaveMessage("✓ API Key saved successfully! Premium access is now activated.");
                  } catch (error: any) {
                    alert("Failed to save key: " + error.message);
                  } finally {
                    setKeySaving(false);
                  }
                }}
                disabled={keySaving}
                className="flex-1 py-2.5 bg-black dark:bg-white text-white dark:text-black font-bold text-xs rounded-xl shadow transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-1.5"
              >
                {keySaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Save API Key</span>
              </button>

              {apiKeyInput && (
                <button
                  onClick={async () => {
                    if (confirm("Are you sure you want to clear your custom Gemini API key?")) {
                      window.localStorage.removeItem("custom_gemini_api_key");
                      if (saveGeminiApiKey) {
                        await saveGeminiApiKey("");
                      }
                      setApiKeyInput("");
                      setKeySaveMessage("✓ Custom key cleared successfully.");
                    }
                  }}
                  className="px-3 py-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl shadow transition-all hover:bg-red-100 cursor-pointer"
                >
                  Clear Key
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Measurement Profiles Selection */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-5">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <UserCheck size={18} className="text-violet-500" />
              Measurement Profiles
            </h3>
            <p className="text-xs text-gray-400 mt-1">Manage multiple users under this single account (e.g. self, child, family members).</p>
          </div>

          {/* List of profiles */}
          <div className="space-y-2">
            {dbUser?.profiles?.map((p) => {
              const isActive = dbUser.activeProfileId === p.id;
              return (
                <div 
                  key={p.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${isActive ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900/50' : 'bg-gray-50/40 dark:bg-slate-800/20 border-gray-100 dark:border-slate-800'}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSwitchProfile(p.id)}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isActive ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-300 dark:border-slate-600'}`}
                    >
                      {isActive && <Check size={12} />}
                    </button>
                    <div>
                      <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                        {p.name}
                        {isActive && <span className="text-3xs bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md uppercase font-black">Active</span>}
                      </span>
                      <span className="text-3xs text-gray-400 block mt-0.5">
                        {p.height}cm · {p.bodyWeight}kg · Arm {p.arms}cm
                      </span>
                    </div>
                  </div>

                  {p.id !== 'default' && (
                    <button 
                      onClick={() => handleDeleteProfile(p.id)}
                      className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add profile form */}
          <form onSubmit={handleAddProfile} className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
            <label className="block text-2xs font-bold text-gray-400 uppercase tracking-widest">Add Measurement Profile</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                required
                placeholder="e.g. My Child, Partner"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-violet-300 outline-none"
              />
              <button 
                type="submit"
                className="px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <UserPlus size={14} /> Add Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col items-center gap-4 text-center transition-colors">
        {dbUser?.photoURL ? (
          <img 
            src={dbUser.photoURL} 
            alt="User" 
            className="w-24 h-24 rounded-full border-4 border-gray-50 dark:border-slate-800 shadow-sm object-cover" 
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Athletic';
            }}
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-400 dark:text-slate-500 border-4 border-gray-50 dark:border-slate-700 shadow-sm">
             <User size={40} />
          </div>
        )}
        <div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white transition-colors">{dbUser?.displayName || 'Gym Rat'}</h2>
          </div>
          <p className="text-gray-500 dark:text-slate-400 font-medium transition-colors">{dbUser?.email}</p>
        </div>

        {/* Selected profile badge */}
        <div className="bg-violet-50/50 dark:bg-violet-950/20 px-3.5 py-1.5 rounded-full border border-violet-100 dark:border-violet-900/40 text-xs font-bold text-violet-700 dark:text-violet-300">
          Active Profile: <span className="font-black text-violet-800 dark:text-violet-200">{activeProfile?.name || 'Self'}</span>
        </div>
        
        <div className="w-full mt-2 flex flex-col items-center gap-2">
          <label className="text-sm font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
            <Scale size={16} /> Body Weight (kg) - <span className="text-violet-600 dark:text-violet-400 font-extrabold">{activeProfile?.name || 'Self'}</span>
          </label>
          <input
            type="number"
            step="0.1"
            value={activeWeight || ''}
            onChange={(e) => {
              const val = e.target.value ? parseFloat(e.target.value) : 0;
              updateActiveProfileMeasurement('bodyWeight', val);
            }}
            placeholder="e.g. 75"
            className="w-28 px-3 py-2 text-center bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
        <button 
          onClick={enterSettings}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors border-b border-gray-100 dark:border-slate-800"
        >
          <div className="flex items-center gap-4 font-medium text-gray-900 dark:text-white">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-slate-400">
              <SettingsIcon size={20} />
            </div>
            Account Settings
          </div>
          <ChevronRight size={20} className="text-gray-400 dark:text-slate-600" />
        </button>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-between p-5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <div className="flex items-center gap-4 font-medium text-red-600 dark:text-red-400">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <LogOut size={20} />
            </div>
            Sign Out
          </div>
          <ChevronRight size={20} className="text-red-400 dark:text-red-500" />
        </button>
      </div>

      <CancelSubscriptionModal 
        isOpen={isCancelModalOpen} 
        onClose={() => setIsCancelModalOpen(false)} 
      />
    </div>
  )
}
