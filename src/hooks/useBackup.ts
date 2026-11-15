import { createBackup, restoreBackup } from '../data/backup/backup';

export function useBackup() {
  return {
    createBackup,
    restoreBackup
  };
}
