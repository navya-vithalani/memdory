import { useEffect, useState } from 'react';
import { useSettings } from '../../hooks/useSettings';

function formatDayStart(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${`${hour % 12 || 12}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function ProfileScreen() {
  const { settings, ready, error, updateSettings, setTheme } = useSettings();
  const [saveError, setSaveError] = useState('');
  const [dailyGoal, setDailyGoal] = useState(`${settings.dailyGoal}`);
  const [newCardsPerDay, setNewCardsPerDay] = useState(`${settings.newCardsPerDay}`);
  const [dayStartMinutes, setDayStartMinutes] = useState(`${settings.dayStartMinutes}`);

  useEffect(() => {
    setDailyGoal(`${settings.dailyGoal}`);
    setNewCardsPerDay(`${settings.newCardsPerDay}`);
    setDayStartMinutes(`${settings.dayStartMinutes}`);
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  async function saveNumber(field: 'dailyGoal' | 'newCardsPerDay' | 'dayStartMinutes', value: number) {
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

  return (
    <main className="screen">
      <h1>Profile</h1>
      {(error || saveError) && <p className="error-message" role="alert">{saveError || error}</p>}
      <div className="stacked-panel">
        <div className="setting-row">
          <span>Theme</span>
          <button className="toggle-pill" disabled={!ready} onClick={() => {
            void setTheme(settings.theme === 'light' ? 'dark' : 'light').catch((reason: unknown) => {
              setSaveError(reason instanceof Error ? reason.message : 'Could not save the theme.');
            });
          }}>{settings.theme === 'light' ? 'Light' : 'Dark'}</button>
        </div>
        <label className="setting-row">
          <span>Daily goal (reviews)</span>
          <input type="number" min="0" max="1000" value={dailyGoal} disabled={!ready} onChange={(event) => setDailyGoal(event.target.value)} onBlur={() => void saveNumber('dailyGoal', Number(dailyGoal))} />
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
    </main>
  );
}
