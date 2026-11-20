import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getCompletedStudyDays } from '../../core/streak/streak';
import { useBackup } from '../../hooks/useBackup';
import { useCards } from '../../hooks/useCards';
import { useSettings } from '../../hooks/useSettings';
import { exportContentAsText } from '../../data/backup/backup';
import { listImports, undoImport } from '../../data/repositories/importRepository';
import type { ImportRecord } from '../../types';
import { APP_NAME, APP_VERSION } from '../../constants';

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
  const [desiredRetention, setDesiredRetention] = useState(`${Math.round((settings.desiredRetention ?? 0.9) * 100)}`);
  const [pastImports, setPastImports] = useState<ImportRecord[]>([]);
  const { createBackup, restoreBackup } = useBackup();
  const { loadSessions } = useCards();
  const { hash } = useLocation();
  const [studyDays, setStudyDays] = useState<string[]>([]);

  const loadPastImports = () => void listImports().then(setPastImports);

  useEffect(() => {
    void loadSessions().then((sessions) => {
      setStudyDays(getCompletedStudyDays(sessions, settings.dayStartMinutes));
    });
    loadPastImports();
  }, [loadSessions, settings.dayStartMinutes]);

  useEffect(() => {
    if (hash === '#backup') document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (hash === '#imports') document.getElementById('imports')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    setDesiredRetention(`${Math.round((settings.desiredRetention ?? 0.9) * 100)}`);
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

  async function saveRetention(percentVal: number) {
    if (!Number.isFinite(percentVal)) return;
    const clamped = Math.max(70, Math.min(99, percentVal));
    const retention = clamped / 100;
    try {
      await updateSettings({ desiredRetention: retention });
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not save retention setting.');
    }
  }

  async function exportData() {
    try {
      const backup = await createBackup();
      const backupTimestamp = Date.now();
      backup.tables.settings = backup.tables.settings.map((setting) => ({
        ...(setting as Record<string, unknown>),
        lastBackupAt: backupTimestamp
      }));
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_NAME}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      await updateSettings({ lastBackupAt: backupTimestamp });
      setBackupStatus('Your full backup is saved to your downloads.');
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not export your backup.');
      setBackupStatus('');
    }
  }

  async function exportContentText() {
    try {
      const content = await exportContentAsText();
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_NAME}-content-${new Date().toISOString().slice(0, 10)}.txt`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBackupStatus('Study content (.txt) exported successfully.');
      setSaveError('');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not export content text.');
    }
  }

  async function importData(file?: File) {
    if (!file) return;
    if (backupMode === 'replace' && !window.confirm(`Replace all ${APP_NAME} data on this device with this backup? This cannot be undone.`)) return;
    try {
      const restored = await restoreBackup(await file.text(), backupMode);
      if (restored.settings) await updateSettings(restored.settings);
      setBackupStatus(backupMode === 'replace' ? 'Backup restored on this device.' : 'Backup merged with your current data.');
      setSaveError('');
      loadPastImports();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not import this backup.');
      setBackupStatus('');
    }
  }

  async function handleUndoImport(id: string) {
    if (!window.confirm('Undo this import? Items created in this batch will be removed.')) return;
    try {
      await undoImport(id);
      loadPastImports();
      setBackupStatus('Import batch undone.');
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to undo import.');
    }
  }

  return (
    <main className="screen settings-screen">
      {(error || saveError) && <p className="error-message" role="alert">{saveError || error}</p>}

      <div className="stacked-panel">
        <div className="profile-section-heading"><h2>Study settings</h2></div>
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
          <span>Target memory retention ({desiredRetention}%)</span>
          <input type="number" min="70" max="99" value={desiredRetention} disabled={!ready} onChange={(e) => setDesiredRetention(e.target.value)} onBlur={() => void saveRetention(Number(desiredRetention))} />
        </label>
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
        <div className="profile-section-heading"><h2>Backup & export</h2></div>
        <p className="muted">Your notes and cards stay on this device. Make a backup before moving to another browser or device.</p>
        {settings.lastBackupAt && <p className="backup-last-saved">Last backup: {new Date(settings.lastBackupAt).toLocaleDateString()}</p>}
        {(!settings.lastBackupAt || Date.now() - settings.lastBackupAt > 7 * 24 * 60 * 60 * 1000) && <p className="backup-reminder">It’s been a while since your last backup. Keep your progress safe.</p>}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="primary-button backup-export" disabled={!ready} onClick={() => void exportData()}>Full backup (.json) ↓</button>
          <button className="secondary-button" disabled={!ready} onClick={() => void exportContentText()}>Export content (.txt) ↓</button>
        </div>

        <label className="field backup-mode" style={{ marginTop: '14px' }}>
          <span>When restoring</span>
          <select value={backupMode} onChange={(event) => setBackupMode(event.target.value as 'merge' | 'replace')}>
            <option value="merge">Merge with this device</option>
            <option value="replace">Replace all local data</option>
          </select>
        </label>
        <label className="secondary-button file-button backup-import">
          Import backup (.json)
          <input type="file" accept=".json,application/json" onChange={(event) => {
            void importData(event.target.files?.[0]);
            event.target.value = '';
          }} />
        </label>
        {backupStatus && <p className="backup-status" role="status">{backupStatus}</p>}
      </section>

      {/* Import history & Undo section (Phase 4.7) */}
      <section id="imports" className="stacked-panel imports-history-panel">
        <div className="profile-section-heading"><h2>Import history</h2></div>
        <p className="muted">Review files you imported and undo batches if needed.</p>
        {pastImports.length === 0 ? (
          <p className="muted">No import history yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pastImports.map((imp) => (
              <div key={imp.id} className="setting-row" style={{ alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong>{imp.fileName}</strong>
                  <small style={{ display: 'block', color: 'var(--ink-soft)' }}>
                    {new Date(imp.timestamp).toLocaleDateString()} · {imp.counts.cards} cards, {imp.counts.notes} notes ({imp.status})
                  </small>
                </div>
                {imp.status === 'applied' ? (
                  <button className="text-button" style={{ color: 'var(--wrong)', fontWeight: 800 }} onClick={() => void handleUndoImport(imp.id)}>
                    Undo
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 700 }}>Undone</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="stacked-panel about-panel">
        <div className="profile-section-heading"><h2>{APP_NAME}</h2></div>
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
      <p className="profile-version">{APP_NAME} <span>·</span> v{APP_VERSION}</p>
    </main>
  );
}
