import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db, defaultSettings, ensureDefaultSettings } from '../data/db';
import type { SettingsRecord, ThemeName } from '../types';

type SettingsContextValue = {
  settings: SettingsRecord;
  ready: boolean;
  error: string;
  setTheme: (theme: ThemeName) => Promise<void>;
  updateSettings: (next: Partial<SettingsRecord>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Loads settings once and shares them, so every screen sees the same live values. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsRecord>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureDefaultSettings();
        const stored = await db.settings.get('settings');
        if (!cancelled) setSettings({ ...defaultSettings, ...stored });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load settings.');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (next: Partial<SettingsRecord>) => {
    const stored = await db.settings.get('settings');
    const merged = { ...defaultSettings, ...stored, ...next };
    await db.settings.put(merged);
    setSettings(merged);
    setError('');
  }, []);

  const setTheme = useCallback((theme: ThemeName) => updateSettings({ theme }), [updateSettings]);

  const value = useMemo(
    () => ({ settings, ready, error, setTheme, updateSettings }),
    [settings, ready, error, setTheme, updateSettings]
  );
  return createElement(SettingsContext.Provider, { value }, children);
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return value;
}
