'use client';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'mech-hoops-theme';
export type Theme = 'light' | 'dark' | 'blue';

const THEME_ORDER: Theme[] = ['light', 'dark', 'blue'];

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: Theme = THEME_ORDER.includes(stored as Theme) ? (stored as Theme) : systemTheme();
    setTheme(initial);
    apply(initial);

    // 无显式选择时跟随系统变化
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const next: Theme = e.matches ? 'dark' : 'light';
        setTheme(next);
        apply(next);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(prev) + 1) % THEME_ORDER.length];
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
