import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RotateCw, RotateCcw, X, Plus, Minus } from 'lucide-react';

interface DegreeWheelPickerProps {
  id?: string;
  value: string | number | undefined | null;
  onChange: (val: string) => void;
  exerciseName?: string;
  minAngle?: number;
  maxAngle?: number;
}

export default function DegreeWheelPicker({
  id,
  value,
  onChange,
  exerciseName = '',
  minAngle = -90,
  maxAngle = 90
}: DegreeWheelPickerProps) {
  const currentDegrees = value !== '' && value !== undefined && value !== null ? Number(value) : null;
  const [isDragging, setIsDragging] = useState(false);
  const wheelRef = useRef<SVGSVGElement>(null);

  // Wheel layout constants
  const size = 220;
  const center = size / 2;
  const radius = 82;
  const knobRadius = 13;

  // Compute angle in degrees from pointer position
  const calculateAngleFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0;
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;

    // Angle relative to vertical top (0 deg is top)
    // Clockwise is positive (+), counter-clockwise is negative (-)
    let angleRad = Math.atan2(dx, -dy);
    let angleDeg = angleRad * (180 / Math.PI);

    // Normalize and clamp between minAngle and maxAngle (e.g. -90 to +90)
    if (angleDeg > 180) angleDeg -= 360;
    if (angleDeg < -180) angleDeg += 360;

    let clamped = Math.max(minAngle, Math.min(maxAngle, angleDeg));
    // Snap to nearest 5 degrees for clean gym increments
    const snapped = Math.round(clamped / 5) * 5;
    return snapped;
  }, [minAngle, maxAngle]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const newAngle = calculateAngleFromPointer(e.clientX, e.clientY);
    onChange(String(newAngle));
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newAngle = calculateAngleFromPointer(e.clientX, e.clientY);
      onChange(String(newAngle));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, calculateAngleFromPointer, onChange]);

  // Visual angle for drawing the knob (0 deg = top)
  const displayAngle = currentDegrees !== null ? currentDegrees : 0;
  const rad = (displayAngle * Math.PI) / 180;
  const knobX = center + radius * Math.sin(rad);
  const knobY = center - radius * Math.cos(rad);

  // SVG arc path from 0 deg to displayAngle
  const arcPath = () => {
    if (currentDegrees === null || currentDegrees === 0) return '';
    const startX = center;
    const startY = center - radius;
    const endX = knobX;
    const endY = knobY;
    const largeArcFlag = Math.abs(displayAngle) > 180 ? 1 : 0;
    const sweepFlag = displayAngle > 0 ? 1 : 0;
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
  };

  // Determine muscle depletion label for Rotary Torso & core machines
  const isRotational = exerciseName.toLowerCase().includes('rotary') || 
                      exerciseName.toLowerCase().includes('torso') ||
                      exerciseName.toLowerCase().includes('twist');

  const getDepletionSideBadge = () => {
    if (currentDegrees === null) return null;
    if (currentDegrees > 0) {
      return {
        side: 'Left Torso (Left External Oblique)',
        short: 'Left Oblique Focus',
        color: 'text-emerald-700 bg-emerald-100/90 dark:text-emerald-300 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500'
      };
    }
    if (currentDegrees < 0) {
      return {
        side: 'Right Torso (Right External Oblique)',
        short: 'Right Oblique Focus',
        color: 'text-cyan-700 bg-cyan-100/90 dark:text-cyan-300 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800',
        dot: 'bg-cyan-500'
      };
    }
    return {
      side: 'Centered / Neutral',
      short: 'Neutral Axis',
      color: 'text-gray-700 bg-gray-100 dark:text-slate-300 dark:bg-slate-800 border-gray-300 dark:border-slate-700',
      dot: 'bg-gray-400'
    };
  };

  const badgeInfo = getDepletionSideBadge();

  // Tick marks definition
  const tickAngles = [-90, -70, -45, -30, -15, 0, 15, 30, 45, 70, 90];

  return (
    <div id={id} className="bg-white/90 dark:bg-slate-900/90 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm select-none transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <RotateCw size={14} className="text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Rotary Degree Wheel
          </span>
        </div>
        {currentDegrees !== null && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Clear angle"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Interactive Rotary Dial SVG */}
      <div className="relative flex flex-col items-center justify-center my-1">
        <svg
          ref={wheelRef}
          width={size}
          height={size}
          className={`cursor-pointer touch-none transition-transform ${isDragging ? 'scale-[1.02]' : ''}`}
          onPointerDown={handlePointerDown}
        >
          {/* Outer track background */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            className="stroke-gray-150 dark:stroke-slate-800/80"
            strokeWidth="10"
            strokeDasharray="4 4"
          />

          {/* Active arc */}
          {arcPath() && (
            <path
              d={arcPath()}
              fill="none"
              stroke={displayAngle > 0 ? '#10b981' : '#06b6d4'}
              strokeWidth="10"
              strokeLinecap="round"
              className="drop-shadow-sm transition-all"
            />
          )}

          {/* Angle tick lines & numbers */}
          {tickAngles.map((angle) => {
            const angleRad = (angle * Math.PI) / 180;
            const isMajor = angle === -70 || angle === -45 || angle === 0 || angle === 45 || angle === 70 || angle === -90 || angle === 90;
            const tickInner = isMajor ? radius - 11 : radius - 7;
            const tickOuter = radius + 8;
            const x1 = center + tickInner * Math.sin(angleRad);
            const y1 = center - tickInner * Math.cos(angleRad);
            const x2 = center + tickOuter * Math.sin(angleRad);
            const y2 = center - tickOuter * Math.cos(angleRad);
            const isCurrent = currentDegrees === angle;

            return (
              <g key={angle}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isCurrent ? '#000' : '#94a3b8'}
                  className={isCurrent ? 'dark:stroke-white' : 'dark:stroke-slate-600'}
                  strokeWidth={isMajor ? (isCurrent ? 3 : 2) : 1}
                />
              </g>
            );
          })}

          {/* Center Hub Display */}
          <circle
            cx={center}
            cy={center}
            r={54}
            className="fill-gray-50 dark:fill-slate-950 stroke-gray-200 dark:stroke-slate-800"
            strokeWidth="2"
          />

          {/* Center Target Indicator Line (0 deg vertical mark) */}
          <line
            x1={center}
            y1={center - radius - 14}
            x2={center}
            y2={center - radius + 14}
            stroke="#94a3b8"
            strokeWidth="2"
            strokeDasharray="2 2"
          />

          {/* Rotatable Thumb/Knob */}
          <g transform={`translate(${knobX}, ${knobY})`}>
            {/* Outer Glow on drag */}
            {isDragging && (
              <circle
                r={knobRadius + 6}
                fill={displayAngle > 0 ? '#10b981' : displayAngle < 0 ? '#06b6d4' : '#64748b'}
                opacity="0.3"
                className="animate-pulse"
              />
            )}
            <circle
              r={knobRadius}
              fill={displayAngle > 0 ? '#10b981' : displayAngle < 0 ? '#06b6d4' : '#3b82f6'}
              className="drop-shadow-md cursor-grab active:cursor-grabbing"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
            <circle r={4} fill="#ffffff" />
          </g>
        </svg>

        {/* Dynamic Center Readout Floating inside Dial */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-0.5">
            <span className="text-2xl font-black tracking-tight font-mono text-gray-900 dark:text-white">
              {currentDegrees !== null ? (currentDegrees > 0 ? `+${currentDegrees}°` : `${currentDegrees}°`) : '0°'}
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mt-0.5">
            {currentDegrees === null ? 'Select' : currentDegrees > 0 ? 'Left Turn' : currentDegrees < 0 ? 'Right Turn' : 'Center'}
          </span>
        </div>
      </div>

      {/* Biomechanical Direction & Unilateral Depletion Indicator */}
      {badgeInfo && (
        <div className={`mt-2 py-1.5 px-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${badgeInfo.color}`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${badgeInfo.dot} animate-pulse`} />
            <span className="font-bold">{badgeInfo.short}</span>
          </div>
          <span className="text-[11px] opacity-85 font-mono">
            {currentDegrees !== null && currentDegrees !== 0 ? (
              currentDegrees > 0 ? '+Deg = Left Side' : '-Deg = Right Side'
            ) : 'Bilateral balance'}
          </span>
        </div>
      )}

      {/* Preset Buttons for Quick One-Tap Selection */}
      <div className="mt-3">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1.5 flex justify-between items-center">
          <span>Common Angles</span>
          <span className="text-[9px] font-medium lowercase">or drag wheel directly</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[-70, -45, 0, 45, 70].map((deg) => {
            const isSelected = currentDegrees === deg;
            const label = deg > 0 ? `+${deg}°` : `${deg}°`;
            return (
              <button
                key={deg}
                type="button"
                onClick={() => onChange(String(deg))}
                className={`py-1.5 px-1 rounded-xl text-xs font-extrabold font-mono transition-all text-center border ${
                  isSelected
                    ? deg > 0
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : deg < 0
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm'
                      : 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                    : 'bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Steppers for Fine-Tuning */}
      <div className="mt-2.5 pt-2.5 border-t border-gray-150 dark:border-slate-800 flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-slate-400 font-medium">Fine Adjustment:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const base = currentDegrees !== null ? currentDegrees : 0;
              onChange(String(Math.max(minAngle, base - 5)));
            }}
            className="p-1 rounded-lg bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition"
            title="Decrease 5 degrees"
          >
            <Minus size={14} />
          </button>
          <span className="font-mono font-bold text-xs px-1.5 text-gray-800 dark:text-slate-200">
            ±5°
          </span>
          <button
            type="button"
            onClick={() => {
              const base = currentDegrees !== null ? currentDegrees : 0;
              onChange(String(Math.min(maxAngle, base + 5)));
            }}
            className="p-1 rounded-lg bg-gray-150 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition"
            title="Increase 5 degrees"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
