import { db } from '../db';
import type { SettingsRecord } from '../../types';

export async function getSettings(): Promise<SettingsRecord | undefined> {
  return db.settings.get('settings');
}

export async function saveSettings(settings: SettingsRecord): Promise<void> {
  await db.settings.put(settings, 'settings');
}
