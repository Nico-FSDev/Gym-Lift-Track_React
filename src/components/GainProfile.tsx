import React from 'react';
import { WorkoutSet } from '../types';
import BodyShapeView from './BodyShapeView';

interface GainProfileProps {
  sets: WorkoutSet[];
  onNavigateToTab?: (tabId: string) => void;
}

export default function GainProfile({ sets, onNavigateToTab }: GainProfileProps) {
  return <BodyShapeView sets={sets} onNavigateToTab={onNavigateToTab} />;
}
