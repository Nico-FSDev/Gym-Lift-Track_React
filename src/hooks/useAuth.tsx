import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MeasurementProfile } from '../types';

export interface DbUserType {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  password?: string;
  activeProfileId?: string;
  profiles?: MeasurementProfile[];
  isPremium?: boolean;
  isAdmin?: boolean;
  geminiApiKey?: string;
  premiumUses?: number;
  premiumUsesResetAt?: number;
  lastRetentionDiscountClaimedAt?: number;
  hasRetentionDiscount?: boolean;
  cancellationReason?: string;
  cancellationDate?: string;
}

export const RESET_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export function getCreditResetCountdown(resetAt?: number): {
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
  nextResetTimestamp: number;
  isDue: boolean;
} {
  const now = Date.now();
  const start = resetAt || now;
  const nextReset = start + RESET_INTERVAL_MS;
  const diff = nextReset - now;

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      formatted: 'Ready to reset',
      nextResetTimestamp: nextReset,
      isDue: true,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let formatted = '';
  if (days > 0) {
    formatted = `${days}d ${hours}h`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m`;
  } else {
    formatted = `${Math.max(1, minutes)}m`;
  }

  return {
    days,
    hours,
    minutes,
    formatted,
    nextResetTimestamp: nextReset,
    isDue: false,
  };
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUserType | null;
  loading: boolean;
  updateAccountDetails: (details: { displayName?: string; photoURL?: string; password?: string }) => Promise<void>;
  updateProfiles: (profiles: MeasurementProfile[], activeProfileId?: string) => Promise<void>;
  updateActiveProfileMeasurement: (key: keyof Omit<MeasurementProfile, 'id' | 'name'>, value: number) => Promise<void>;
  saveGeminiApiKey: (apiKey: string) => Promise<void>;
  setPremiumStatus: (status: boolean) => Promise<void>;
  incrementPremiumUses: () => Promise<number>;
  cancelSubscription: (reason?: string, feedback?: string) => Promise<void>;
  applyRetentionDiscount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  loading: true,
  updateAccountDetails: async () => {},
  updateProfiles: async () => {},
  updateActiveProfileMeasurement: async () => {},
  saveGeminiApiKey: async () => {},
  setPremiumStatus: async () => {},
  incrementPremiumUses: async () => 0,
  cancelSubscription: async () => {},
  applyRetentionDiscount: async () => {},
});

const defaultProfiles: MeasurementProfile[] = [
  {
    id: 'default',
    name: 'Self',
    height: 175,
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
  }
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (authUser) {
        const userRef = doc(db, 'users', authUser.uid);
        
        // Setup Firestore document snapshot listener
        unsubscribeSnapshot = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const profilesData = data.profiles || defaultProfiles;
            const activeId = data.activeProfileId || 'default';
            
            const now = Date.now();
            const resetAt = data.premiumUsesResetAt || now;
            const timeSinceReset = now - resetAt;

            let effectiveUses = data.premiumUses ?? 0;
            let effectiveResetAt = resetAt;

            if (!data.premiumUsesResetAt || timeSinceReset >= RESET_INTERVAL_MS) {
              effectiveUses = 0;
              effectiveResetAt = now;
              updateDoc(userRef, {
                premiumUses: 0,
                premiumUsesResetAt: now
              }).catch(err => console.error("Error auto-resetting weekly credits:", err));
            }

            setDbUser({
              uid: authUser.uid,
              displayName: data.displayName || authUser.displayName || 'No Name',
              email: data.email || authUser.email || '',
              photoURL: data.photoURL || authUser.photoURL || '',
              password: data.password || '',
              activeProfileId: activeId,
              profiles: profilesData,
              isPremium: data.isPremium ?? false,
              isAdmin: data.isAdmin ?? false,
              geminiApiKey: data.geminiApiKey || '',
              premiumUses: effectiveUses,
              premiumUsesResetAt: effectiveResetAt,
              lastRetentionDiscountClaimedAt: data.lastRetentionDiscountClaimedAt,
              hasRetentionDiscount: data.hasRetentionDiscount ?? false,
              cancellationReason: data.cancellationReason || '',
              cancellationDate: data.cancellationDate || '',
            });

            if (data.geminiApiKey && typeof window !== 'undefined') {
              window.localStorage.setItem('custom_gemini_api_key', data.geminiApiKey);
            }

            // Keep local storage keys in sync with active profile measurements
            const activeProfile = profilesData.find((p: any) => p.id === activeId) || profilesData[0];
            if (activeProfile) {
              const keys = ['height', 'bodyWeight', 'boneMass', 'bodyFat', 'arms', 'chest', 'waist', 'thighs', 'calves', 'neck', 'shoulders'] as const;
              keys.forEach(key => {
                const lsKey = `user-${key.toLowerCase()}`;
                window.localStorage.setItem(lsKey, String(activeProfile[key]));
              });
            }
          } else {
            // Document doesn't exist, create it
            const isAdminEmail = authUser.email === 'n.lohberger.pro@gmail.com' || authUser.email === 'lohbergerscholar@gmail.com';
            const initialData = {
              uid: authUser.uid,
              displayName: authUser.displayName || 'No Name',
              email: authUser.email || '',
              photoURL: authUser.photoURL || '',
              password: '',
              activeProfileId: 'default',
              profiles: defaultProfiles,
              lastActive: serverTimestamp(),
              isPremium: isAdminEmail,
              isAdmin: isAdminEmail,
              geminiApiKey: '',
              premiumUses: 0,
              premiumUsesResetAt: Date.now()
            };
            setDoc(userRef, initialData).catch(err => {
              console.error('Failed to create user document:', err);
            });
          }
        }, (error) => {
          console.error('Error listening to user document:', error);
        });
      } else {
        setDbUser(null);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const updateAccountDetails = useCallback(async (details: { displayName?: string; photoURL?: string; password?: string }) => {
    if (!user) throw new Error('Not authenticated');
    const userRef = doc(db, 'users', user.uid);
    const cleanDetails = { ...details };
    // Remove undefined fields
    Object.keys(cleanDetails).forEach(key => {
      if ((cleanDetails as any)[key] === undefined) {
        delete (cleanDetails as any)[key];
      }
    });
    await updateDoc(userRef, cleanDetails);
  }, [user]);

  const updateProfiles = useCallback(async (profiles: MeasurementProfile[], activeProfileId?: string) => {
    if (!user) throw new Error('Not authenticated');
    const userRef = doc(db, 'users', user.uid);
    const updateData: any = { profiles };
    if (activeProfileId) {
      updateData.activeProfileId = activeProfileId;
    }
    await updateDoc(userRef, updateData);
  }, [user]);

  const updateActiveProfileMeasurement = useCallback(async (key: keyof Omit<MeasurementProfile, 'id' | 'name'>, value: number) => {
    if (!user || !dbUser || !dbUser.profiles) return;
    const activeId = dbUser.activeProfileId || 'default';
    const updatedProfiles = dbUser.profiles.map(p => {
      if (p.id === activeId) {
        return { ...p, [key]: value };
      }
      return p;
    });
    
    // Optimistic local storage update for instant feedback
    window.localStorage.setItem(`user-${key.toLowerCase()}`, String(value));

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      profiles: updatedProfiles
    });
  }, [user, dbUser]);

  const saveGeminiApiKey = useCallback(async (apiKey: string) => {
    if (!user) throw new Error('Not authenticated');
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { geminiApiKey: apiKey });
  }, [user]);

  const setPremiumStatus = useCallback(async (status: boolean) => {
    if (dbUser) {
      setDbUser(prev => prev ? { ...prev, isPremium: status } : null);
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { isPremium: status });
    }
  }, [user, dbUser]);

  const incrementPremiumUses = useCallback(async (): Promise<number> => {
    if (!user) throw new Error('Not authenticated');
    const userRef = doc(db, 'users', user.uid);
    const now = Date.now();
    const resetAt = dbUser?.premiumUsesResetAt || now;
    const timeSinceReset = now - resetAt;

    let newCount = 1;
    if (!dbUser?.premiumUsesResetAt || timeSinceReset >= RESET_INTERVAL_MS) {
      newCount = 1;
      await updateDoc(userRef, { premiumUses: 1, premiumUsesResetAt: now });
    } else {
      newCount = (dbUser?.premiumUses ?? 0) + 1;
      await updateDoc(userRef, { premiumUses: newCount });
    }
    return newCount;
  }, [user, dbUser]);

  const applyRetentionDiscount = useCallback(async () => {
    const now = Date.now();
    if (dbUser) {
      setDbUser(prev => prev ? {
        ...prev,
        hasRetentionDiscount: true,
        lastRetentionDiscountClaimedAt: now,
      } : null);
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        hasRetentionDiscount: true,
        lastRetentionDiscountClaimedAt: now,
      });
    }
  }, [user, dbUser]);

  const cancelSubscription = useCallback(async (reason?: string, feedback?: string) => {
    const nowISO = new Date().toISOString();
    window.localStorage.removeItem("custom_gemini_api_key");
    if (dbUser) {
      setDbUser(prev => prev ? {
        ...prev,
        isPremium: false,
        geminiApiKey: '',
        cancellationReason: reason || 'Not specified',
        cancellationFeedback: feedback || '',
        cancellationDate: nowISO,
      } : null);
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isPremium: false,
        geminiApiKey: '',
        cancellationReason: reason || 'Not specified',
        cancellationFeedback: feedback || '',
        cancellationDate: nowISO,
      });
    }
  }, [user, dbUser]);

  const contextValue = useMemo(() => ({
    user,
    dbUser,
    loading,
    updateAccountDetails,
    updateProfiles,
    updateActiveProfileMeasurement,
    saveGeminiApiKey,
    setPremiumStatus,
    incrementPremiumUses,
    cancelSubscription,
    applyRetentionDiscount
  }), [
    user,
    dbUser,
    loading,
    updateAccountDetails,
    updateProfiles,
    updateActiveProfileMeasurement,
    saveGeminiApiKey,
    setPremiumStatus,
    incrementPremiumUses,
    cancelSubscription,
    applyRetentionDiscount
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
