'use client';

import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { useTheme, ThemeMode } from './ThemeProvider';

export function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const options: Array<{ mode: ThemeMode; label: string; icon: typeof Moon }> = [
    { mode: 'dark', label: 'Oscuro', icon: Moon },
    { mode: 'light', label: 'Claro', icon: Sun },
    { mode: 'system', label: 'Automático', icon: Laptop },
  ];

  const CurrentIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Seleccionar tema (Oscuro, Claro, Automático)"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--pink-primary)] transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--violet-primary)]"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-40 origin-top-right rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 shadow-xl backdrop-blur-md z-50 focus:outline-none"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const isSelected = theme === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="menuitem"
                onClick={() => {
                  setTheme(option.mode);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium transition duration-150 ${
                  isSelected
                    ? 'bg-gradient-to-r from-[var(--pink-primary)] to-[var(--violet-primary)] text-white shadow-sm font-semibold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{option.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
