import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | DropdownOption)[];
  placeholder?: string;
  className?: string; // Additional classes for the button or wrapper if necessary, or just rely on what is inside
  buttonClassName?: string;
  menuClassName?: string;
}

export default function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
  buttonClassName = "w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-slate-900/50 text-black dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none transition-all text-sm font-medium",
  menuClassName = "absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 py-1.5 focus:outline-none"
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedOptions: DropdownOption[] = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <div className={`relative w-full ${className || ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={buttonClassName}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
        </span>
        <ChevronDown size={14} className={`text-gray-500 shrink-0 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={menuClassName}>
          {normalizedOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 ${value === opt.value ? 'bg-gray-50/50 dark:bg-slate-700/30 font-semibold text-black dark:text-white' : 'text-gray-600 dark:text-slate-300'}`}
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && <Check size={16} className="text-black dark:text-white shrink-0 ml-2" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
