import Dexie from 'dexie';

export async function checkAndRunPreUpgradeSafetyBackup(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const dbNames = ['memdory-db', 'memdory-db', 'remembree-db'];
  let targetDbName: string | null = null;

  for (const name of dbNames) {
    if (await Dexie.exists(name)) {
      targetDbName = name;
      break;
    }
  }

  if (!targetDbName) return false;

  const key = `pre-upgrade-backup-${targetDbName}-v4-done`;
  if (localStorage.getItem(key)) return false;

  try {
    const rawDb = new Dexie(targetDbName);
    await rawDb.open();
    if (rawDb.verno >= 4) {
      rawDb.close();
      localStorage.setItem(key, 'true');
      return false;
    }

    const payload: Record<string, unknown> = {
      app: 'memdory',
      exportedAt: Date.now(),
      schemaVersion: rawDb.verno,
      tables: {}
    };

    const tablesObj: Record<string, unknown[]> = {};
    for (const table of rawDb.tables) {
      tablesObj[table.name] = await table.toArray();
    }
    payload.tables = tablesObj;

    rawDb.close();

    const todayStr = new Date().toISOString().slice(0, 10);
    const fileName = `memdory-pre-upgrade-${todayStr}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    localStorage.setItem(key, 'true');
    return true;
  } catch (err) {
    console.warn('Pre-upgrade safety backup skipped or failed:', err);
    return false;
  }
}
