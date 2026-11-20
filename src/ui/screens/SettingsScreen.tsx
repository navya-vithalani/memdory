import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getCompletedStudyDays } from '../../core/streak/streak';
import { useBackup } from '../../hooks/useBackup';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import { Mnemo } from '../components/Mnemo';

function formatDayStart(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${`${hour % 12 || 12}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function SettingsScreen() {
  const { settings, ready, error, updateSettings, setTheme } = useSettings();
  const [saveError, setSaveError] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [backupMode, setBackupMode] = useState<'merge' | 'replace'>('merge');
  const [newCardsPerDay, setNewCardsPerDay] = useState(`${settings.newCardsPerDay}`);
  const [dayStartMinutes, setDayStartMinutes] = useState(`${settings.dayStartMinutes}`);
  const { createBackup, restoreBackup } = useBackup();
  const { loadSessions } = useCards();
  const { hash } = useLocation();
  const [studyDays, setStudyDays] = useState<string[]>([]);

  useEffect(() => {
    void loadSessions().then((sessions) => {
      setStudyDays(getCompletedStudyDays(sessions, settings.dayStartMinutes));
    });
  }, [loadSessions, settings.dayStartMinutes]);

  useEffect(() => {
    if (hash === '#backup') document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, ready]);

  async function toggleSetting(field: 'showTags' | 'showMnemoInSession') {
    try {
      await updateSettings({ [field]: settings[field] === false });
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not save this setting.');
    }
  }

  useEffect(() => {
    setNewCardsPerDay(`${settings.newCardsPerDay}`);
    setDayStartMinutes(`${settings.dayStartMinutes}`);
  }, [settings]);

  async function saveNumber(field: 'newCardsPerDay' | 'dayStartMinutes', value: number) {
    if (!Number.isFinite(value)) {
      setSaveError('Enter a valid number.');
      return;
    }
    const limit = field === 'dayStartMinutes' ? 1439 : 1000;
    const next = Math.max(0, Math.min(limit, Math.floor(value)));
    try {
      await updateSettings({ [field]: next });
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not save this setting.');
    }
  }

  async function exportData() {
    try {
      const backup = await createBackup();
      const backupTimestamp = Date.now();
      backup.tables.settings = backup.tables.settings.map((setting) => ({
        ...setting,
        lastBackupAt: backupTimestamp
      }));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `memdory-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      await updateSettings({ lastBackupAt: backupTimestamp });
      setBackupStatus('Your backup is ready and saved to your downloads.');
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not export your backup.');
      setBackupStatus('');
    }
  }

  async function importData(file?: File) {
    if (!file) return;
    if (backupMode === 'replace' && !window.confirm('Replace all memdory data on this device with this backup? This cannot be undone.')) return;
    try {
      const restoredSettings = await restoreBackup(await file.text(), backupMode);
      if (restoredSettings) await updateSettings(restoredSettings);
      setBackupStatus(backupMode === 'replace' ? 'Backup restored on this device.' : 'Backup merged with your current data.');
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not import this backup.');
      setBackupStatus('');
    }
  }

  return (
    <main className="screen">
      <header className="screen-intro"><p className="eyebrow">Make it yours</p><h1>Settings</h1><p className="muted">Your study space, your way.</p><Mnemo mood="sleepy" className="screen-mascot profile-mascot" /></header>
      {(error || saveError) && <p className="error-message" role="alert">{saveError || error}</p>}
      <div className="stacked-panel">
        <div className="profile-section-heading"><p className="eyebrow">Preferences</p><h2>Study settings</h2></div>
        <div className="setting-row">
          <span>Theme</span>
          <button className="toggle-pill theme-toggle" aria-pressed={settings.theme === 'dark'} disabled={!ready} onClick={() => {
            void setTheme(settings.theme === 'light' ? 'dark' : 'light').catch((reason: unknown) => {
              setSaveError(reason instanceof Error ? reason.message : 'Could not save the theme.');
            });
          }}><span aria-hidden="true">{settings.theme === 'light' ? '☼' : '☾'}</span> {settings.theme === 'light' ? 'Light' : 'Dark'}</button>
        </div>
        <div className="setting-row">
          <span>Show tags on cards</span>
          <button className="toggle-pill" aria-pressed={settings.showTags !== false} disabled={!ready} onClick={() => void toggleSetting('showTags')}>{settings.showTags !== false ? 'On' : 'Off'}</button>
        </div>
        <div className="setting-row">
          <span>Show Mnemo in sessions</span>
          <button className="toggle-pill" aria-pressed={settings.showMnemoInSession !== false} disabled={!ready} onClick={() => void toggleSetting('showMnemoInSession')}>{settings.showMnemoInSession !== false ? 'On' : 'Off'}</button>
        </div>
        <label className="setting-row">
          <span>New-card cap per day</span>
          <input type="number" min="0" max="1000" value={newCardsPerDay} disabled={!ready} onChange={(event) => setNewCardsPerDay(event.target.value)} onBlur={() => void saveNumber('newCardsPerDay', Number(newCardsPerDay))} />
        </label>
        <label className="setting-row">
          <span>Study day starts at ({formatDayStart(settings.dayStartMinutes)})</span>
          <input type="number" min="0" max="1439" value={dayStartMinutes} disabled={!ready} onChange={(event) => setDayStartMinutes(event.target.value)} onBlur={() => void saveNumber('dayStartMinutes', Number(dayStartMinutes))} />
        </label>
      </div>
      <section id="backup" className="stacked-panel backup-panel">
        <div className="profile-section-heading"><p className="eyebrow">Keep your data safe</p><h2>Backup & restore</h2></div>
        <p className="muted">Your notes and cards stay on this device. Make a backup before moving to another browser or device.</p>
        {settings.lastBackupAt && <p className="backup-last-saved">Last backup: {new Date(settings.lastBackupAt).toLocaleDateString()}</p>}
        {(!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * 24 * 60 * 60 * 1000) && <p className="backup-reminder">It’s been a while since your last backup. Keep your progress safe.</p>}
        <button className="primary-button backup-export" disabled={!ready} onClick={() => void exportData()}>Export backup <span aria-hidden="true">↓</span></button>
        <label className="field backup-mode">
          <span>When restoring</span>
          <select value={backupMode} onChange={(event) => setBackupMode(event.target.value as 'merge' | 'replace')}>
            <option value="merge">Merge with this device</option>
            <option value="replace">Replace all local data</option>
          </select>
        </label>
        <label className="secondary-button file-button backup-import">
          Import backup
          <input type="file" accept=".json,application/json" onChange={(event) => {
            void importData(event.target.files?.[0]);
            event.target.value = '';
          }} />
        </label>
        {backupStatus && <p className="backup-status" role="status">{backupStatus}</p>}
      </section>
      <section className="stacked-panel about-panel">
        <div className="profile-section-heading"><p className="eyebrow">About</p><h2>memdory</h2></div>
        <p className="muted">Offline-first flashcards and notes with FSRS spaced repetition.</p>
        <details className="study-days-debug">
          <summary>Study days (debug: {studyDays.length})</summary>
          <div>
            {studyDays.length === 0 ? (
              <p className="muted">No completed study days recorded yet.</p>
            ) : (
              <ul>
                {studyDays.map((day) => (
                  <li key={day}>{day}</li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </section>
      <p className="profile-version">memdory <span>·</span> v0.1.0</p>
    </main>
  );
}
