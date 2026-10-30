import { Timestamp } from "firebase/firestore";

export interface Posture {
  name: string;
  weightModifier: number;
}

export interface MeasurementProfile {
  id: string;
  name: string;
  height: number;
  bodyWeight: number;
  boneMass: number;
  bodyFat: number;
  arms: number;
  chest: number;
  waist: number;
  thighs: number;
  calves: number;
  neck: number;
  shoulders: number;
  importSource?: 'manual' | 'fitbit';
  lastSyncDate?: string;
}

export interface WorkoutSet {
  id?: string;
  userId: string;
  exercise: string;
  category?: string;
  date: Timestamp;
  reps: number;
  weightLbs: number;
  weightKg: number;
  degrees?: number;
  variant?: string;
  posture?: string;
  weightModifier?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  customFields?: Record<string, string>;
}

export interface MachineConfig {
  id?: string;
  userId: string;
  exercise: string;
  baseWeightLbs: number;
  baseWeightKg: number;
  brand?: string;
  category?: string;
  variantCategories?: Record<string, string>;
  type?: 'Machine' | 'Weightlifting' | 'Exercise';
  originalName?: string;
  linkedMuscles?: string[];
  linkedGroups?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  customFields?: string[];
  postures?: Posture[];
  invertWeight?: boolean;
  invertBaseWeight?: boolean;
}

