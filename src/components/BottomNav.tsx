import React from 'react';
import { Dumbbell, BarChart2, BicepsFlexed, Flame } from 'lucide-react';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';

interface BottomNavProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const isKeyboardOpen = useVirtualKeyboard();

  const navItems = [
    { id: 'bodybuilding', icon: Dumbbell, label: 'Lift' },
    { id: 'bodyShape', icon: BicepsFlexed, label: 'Body Shape' },
    { id: 'calories', icon: Flame, label: 'Calories' },
    { id: 'charts', icon: BarChart2, label: 'Stats' },
  ];

  if (isKeyboardOpen) {
    return null;
  }

  return (
    <div id="bottom-navigation-bar" className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-50 px-4 pb-safe transition-colors duration-300" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              id={`nav-tab-${item.id}`}
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center justify-center px-4 h-full space-y-1 transition-all ${
                isActive ? 'text-black dark:text-white' : 'text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-slate-300'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'transform scale-110 transition-transform' : 'transition-transform'} />
              <span className={`text-[11px] font-bold transition-colors ${isActive ? 'text-black dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
