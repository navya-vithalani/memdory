import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBackup } from '../../hooks/useBackup';
import { useSettings } from '../../hooks/useSettings';
import { exportContentAsText } from '../../data/backup/backup';
import { listImports, undoImport } from '../../data/repositories/importRepository';
import { resetAppDatabase } from '../../data/db';
import type { ImportRecord } from '../../types';
import { APP_NAME, APP_VERSION } from '../../constants';

export function ProfileScreen() {
  const { settings, ready, error, updateSettings, setTheme } = useSettings();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState('');
  const [userName, setUserName] = useState(settings.userName || 'dory');
  const [targetCards, setTargetCards] = useState(`${settings.targetCardsPerDay ?? settings.dailyGoal ?? 20}`);
  const [desiredRetention, setDesiredRetention] = useState(`${Math.round((settings.desiredRetention ?? 0.9) * 100)}`);
  const [backupStatus, setBackupStatus] = useState('');
  const [backupMode, setBackupMode] = useState<'merge' | 'replace'>('merge');
  const [pastImports, setPastImports] = useState<ImportRecord[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { createBackup, restoreBackup } = useBackup();
  const { hash } = useLocation();

  useEffect(() => {
    setUserName(settings.userName || 'dory');
    setTargetCards(`${settings.targetCardsPerDay ?? settings.dailyGoal ?? 20}`);
    setDesiredRetention(`${Math.round((settings.desiredRetention ?? 0.9) * 100)}`);
  }, [settings]);

  useEffect(() => {
    void listImports().then(setPastImports);
  }, []);

  useEffect(() => {
    if (hash === '#backup') document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (hash === '#imports') document.getElementById('imports')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, ready]);

  // Convert minutes (e.g. 210) to "03:30" string for <input type="time">
  const timeString = (() => {
    const total = ((settings.dayStartMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`;
  })();

  async function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) return;
    const [hours, mins] = val.split(':').map(Number);
    const minutes = hours * 60 + mins;
    try {
      await updateSettings({ dayStartMinutes: minutes });
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save day start time.');
    }
  }

  async function handleSaveName() {
    const trimmed = userName.trim() || 'dory';
    try {
      await updateSettings({ userName: trimmed });
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save name.');
    }
  }

  async function handleSaveTargetCards(value: number) {
    if (!Number.isFinite(value) || value < 1) return;
    const count = Math.min(500, Math.max(1, Math.floor(value)));
    try {
      await updateSettings({ targetCardsPerDay: count, dailyGoal: count });
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save target cards.');
    }
  }

  async function handleSaveRetention(percentVal: number) {
    if (!Number.isFinite(percentVal)) return;
    const clamped = Math.max(70, Math.min(99, percentVal));
    try {
      await updateSettings({ desiredRetention: clamped / 100 });
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save retention setting.');
    }
  }

  async function toggleSetting(field: 'showTags' | 'showMnemoInSession') {
    try {
      await updateSettings({ [field]: settings[field] === false });
      setSaveError('');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save this setting.');
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
      URL.revokeObjectURL(url);
      await updateSettings({ lastBackupAt: backupTimestamp });
      setBackupStatus('Backup downloaded successfully.');
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Could not generate backup.');
    }
  }

  async function exportNotesAndCards() {
    try {
      const text = await exportContentAsText();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_NAME}-content-${new Date().toISOString().slice(0, 10)}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupStatus('Content exported as text.');
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Could not export content.');
    }
  }

  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await restoreBackup(text, backupMode);
      const totalCount = Object.values(result.counts).reduce((a, b) => a + b, 0);
      setBackupStatus(
        `Restored ${totalCount} records across database tables (${backupMode} mode).`
      );
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : 'Could not restore backup file.');
    }
  }

  async function handleUndoImport(id: string) {
    if (!confirm('Undo this import? Any items created by this import will be removed.')) return;
    try {
      await undoImport(id);
      setPastImports(await listImports());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not undo import.');
    }
  }

  async function handleResetApp() {
    setResetting(true);
    try {
      await resetAppDatabase();
      setShowResetConfirm(false);
      navigate('/', { replace: true });
      window.location.reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not reset application.');
      setResetting(false);
    }
  }

  return (
    <main className="screen profile-screen settings-screen">
      {(error || saveError) && <p className="error-message" role="alert">{error || saveError}</p>}

      {/* User Name & Profile Section */}
      <section className="stacked-panel profile-user-panel" style={{ background: 'var(--surface)', padding: '20px', borderRadius: 'var(--radius-large)' }}>
        <div className="profile-section-heading">
          <h2>Profile</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginTop: '12px' }}>
          <label className="field" style={{ flex: 1, margin: 0 }}>
            <span>Your Name</span>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. dory"
            />
          </label>
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: '44px', padding: '0 18px', fontWeight: 800 }}
            onClick={handleSaveName}
          >
            Save
          </button>
        </div>
      </section>

      {/* Daily Target & Goals */}
      <section className="stacked-panel" style={{ marginTop: '16px' }}>
        <div className="profile-section-heading">
          <h2>Daily Study Goals</h2>
        </div>

        <label className="field" style={{ marginTop: '14px' }}>
          <span>Target cards per day</span>
          <input
            type="number"
            min="1"
            max="500"
            value={targetCards}
            onChange={(e) => {
              setTargetCards(e.target.value);
              const num = Number(e.target.value);
              if (num > 0) void handleSaveTargetCards(num);
            }}
          />
          <small className="field-hint">Used as a goal reference line in charts</small>
        </label>

        <label className="field" style={{ marginTop: '14px' }}>
          <span>Target recall rate (%)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="70"
              max="99"
              value={desiredRetention}
              onChange={(e) => {
                setDesiredRetention(e.target.value);
                void handleSaveRetention(Number(e.target.value));
              }}
              style={{ flex: 1 }}
            />
            <strong style={{ width: '48px', textAlign: 'right', color: 'var(--navy)', fontSize: '15px' }}>
              {desiredRetention}%
            </strong>
          </div>
          <small className="field-hint">Higher retention schedules reviews more frequently</small>
        </label>

        {/* User friendly Time selector for day starts */}
        <label className="field" style={{ marginTop: '14px' }}>
          <span>Day starts at</span>
          <input
            type="time"
            value={timeString}
            onChange={handleTimeChange}
            style={{ fontSize: '16px', fontWeight: 700 }}
          />
          <small className="field-hint">Reviews before this time count towards the previous study day</small>
        </label>
      </section>

      {/* Appearance & Preferences */}
      <section className="stacked-panel" style={{ marginTop: '16px' }}>
        <div className="profile-section-heading">
          <h2>Preferences</h2>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
          <button
            type="button"
            className={settings.theme === 'light' ? 'primary-button' : 'secondary-button'}
            style={{ flex: 1, minHeight: '40px' }}
            onClick={() => void setTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={settings.theme === 'dark' ? 'primary-button' : 'secondary-button'}
            style={{ flex: 1, minHeight: '40px' }}
            onClick={() => void setTheme('dark')}
          >
            Dark
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '18px' }}>
          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showMnemoInSession !== false}
              onChange={() => void toggleSetting('showMnemoInSession')}
            />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Show Mnemo companion in study sessions</span>
          </label>

          <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.showTags !== false}
              onChange={() => void toggleSetting('showTags')}
            />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Show tag chips on study cards</span>
          </label>
        </div>
      </section>

      {/* Backup and Data Management */}
      <section className="stacked-panel" id="backup" style={{ marginTop: '16px' }}>
        <div className="profile-section-heading">
          <h2>Backup & Export</h2>
        </div>
        <p className="muted" style={{ margin: '6px 0 14px' }}>
          {settings.lastBackupAt
            ? `Last backup saved on ${new Date(settings.lastBackupAt).toLocaleDateString()}.`
            : 'No backup saved yet.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" className="secondary-button" onClick={() => void exportData()}>
            Download JSON backup
          </button>
          <button type="button" className="secondary-button" onClick={() => void exportNotesAndCards()}>
            Export content as .txt
          </button>
        </div>

        <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          <label className="field" style={{ margin: 0 }}>
            <span>Restore from backup</span>
            <div style={{ display: 'flex', gap: '12px', margin: '8px 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
                <input
                  type="radio"
                  name="restoreMode"
                  checked={backupMode === 'merge'}
                  onChange={() => setBackupMode('merge')}
                />
                Merge
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
                <input
                  type="radio"
                  name="restoreMode"
                  checked={backupMode === 'replace'}
                  onChange={() => setBackupMode('replace')}
                />
                Replace all
              </label>
            </div>
            <input type="file" accept=".json" onChange={(e) => void importData(e)} />
          </label>
        </div>
        {backupStatus && <p className="success-message" role="status" style={{ marginTop: '12px' }}>{backupStatus}</p>}
      </section>

      {/* Past Imports with Undo */}
      {pastImports.length > 0 && (
        <section className="stacked-panel" id="imports" style={{ marginTop: '16px' }}>
          <div className="profile-section-heading">
            <h2>Recent Imports</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            {pastImports.slice(0, 5).map((imp) => (
              <div key={imp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{imp.fileName}</strong>
                  <small style={{ display: 'block', color: 'var(--ink-soft)' }}>
                    {new Date(imp.timestamp).toLocaleDateString()} · {imp.counts.cards} cards, {imp.counts.notes} notes ({imp.status})
                  </small>
                </div>
                {imp.status === 'applied' ? (
                  <button
                    className="text-button"
                    style={{ color: 'var(--wrong)', fontWeight: 800 }}
                    onClick={() => void handleUndoImport(imp.id)}
                  >
                    Undo
                  </button>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 700 }}>Undone</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Red Danger Zone: Reset App */}
      <section className="stacked-panel danger-zone-panel" style={{ marginTop: '20px', borderColor: 'var(--wrong)', background: 'color-mix(in srgb, var(--wrong) 6%, var(--surface))' }}>
        <div className="profile-section-heading">
          <h2 style={{ color: 'var(--wrong)' }}>Danger Zone</h2>
        </div>
        <p style={{ margin: '6px 0 14px', fontSize: '13px', color: 'var(--ink-soft)' }}>
          Permanently erase all flashcards, notes, study history, streak logs, and reset settings to default.
        </p>
        <button
          type="button"
          className="primary-button danger-reset-btn"
          style={{ background: 'var(--wrong)', color: '#ffffff', minHeight: '44px', fontWeight: 800 }}
          onClick={() => setShowResetConfirm(true)}
        >
          Reset App
        </button>
      </section>

      <p className="profile-version" style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'var(--ink-soft)' }}>
        {APP_NAME} <span>·</span> v{APP_VERSION}
      </p>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !resetting) setShowResetConfirm(false);
          }}
        >
          <div className="session-modal" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
            <h2 id="reset-modal-title" style={{ color: 'var(--wrong)', margin: '0 0 12px' }}>
              Reset everything?
            </h2>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5 }}>
              This action cannot be undone. All your study areas, notes, cards, sessions, and streak history will be wiped clean.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ flex: 1 }}
                disabled={resetting}
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ flex: 1, background: 'var(--wrong)', color: '#fff' }}
                disabled={resetting}
                onClick={() => void handleResetApp()}
              >
                {resetting ? 'Resetting…' : 'Yes, reset app'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
