import { useEffect, useState } from 'react';
import { db, defaultSettings, ensureDefaultSettings } from '../data/db';
import type { SettingsRecord, ThemeName } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsRecord>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await ensureDefaultSettings();
        const stored = await db.settings.get('settings');
        if (!cancelled) setSettings(stored ?? defaultSettings);
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

  const updateSettings = async (next: Partial<SettingsRecord>) => {
    const merged = { ...settings, ...next };
    await db.settings.put(merged);
    setSettings(merged);
    setError('');
  };

  const setTheme = async (theme: ThemeName) => {
    await updateSettings({ theme });
  };

  return { settings, ready, error, setTheme, updateSettings };
}
