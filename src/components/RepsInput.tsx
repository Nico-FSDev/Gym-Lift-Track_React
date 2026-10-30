import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface RepsInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  min?: string | number;
  placeholder?: string;
  className?: string;
}

const PRESET_REPS = [4, 6, 8, 10, 12];

export default function RepsInput({
  id,
  value,
  onChange,
  required = true,
  min = '1',
  placeholder = '0',
  className = ''
}: RepsInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPreset = (reps: number) => {
    onChange(String(reps));
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="relative flex items-center h-[56px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white transition-all shadow-sm">
        {/* Editable input for personalized reps */}
        <input
          ref={inputRef}
          id={id}
          type="number"
          required={required}
          min={min}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-full pl-3.5 pr-9 bg-transparent text-lg font-bold text-black dark:text-white text-center focus:outline-none placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        {/* Dropdown toggle button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className="absolute right-1.5 h-9 w-7 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-200/50 dark:hover:bg-slate-800 transition-colors"
          title="Quick select reps (4, 6, 8, 10, 12)"
          aria-label="Select reps preset"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-black dark:text-white' : ''}`}
          />
        </button>
      </div>

      {/* Preset Reps Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 right-0 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 p-1.5 backdrop-blur-md">
          <div className="px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800 mb-1">
            Quick Reps
          </div>
          <div className="space-y-0.5">
            {PRESET_REPS.map((num) => {
              const isSelected = String(num) === String(value);
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectPreset(num)}
                  className={`w-full min-h-[40px] px-3 py-1.5 flex items-center justify-between rounded-xl text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-mono text-base">{num}</span>
                  <span className="text-xs font-semibold opacity-70">
                    {isSelected ? (
                      <span className="flex items-center gap-1 font-bold">
                        <Check size={13} strokeWidth={3} /> selected
                      </span>
                    ) : (
                      'reps'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
