function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - 1);
  return formatLocalDate(date);
}

export function nextDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + 1);
  return formatLocalDate(date);
}

export function getStudyDayStartTimestamp(timestamp: number, dayStartMinutes: number): number {
  const dayStart = ((dayStartMinutes % 1440) + 1440) % 1440;
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(dayStart);
  if (date.getTime() > timestamp) date.setDate(date.getDate() - 1);
  return date.getTime();
}

export function studyDayKey(timestamp: number, dayStartMinutes: number): string {
  const date = new Date(timestamp);
  const dayStart = ((dayStartMinutes % 1440) + 1440) % 1440;
  const localMinutes = date.getHours() * 60 + date.getMinutes();
  if (localMinutes < dayStart) date.setDate(date.getDate() - 1);
  return formatLocalDate(date);
}

export interface StreakSession {
  id?: string;
  status: 'in-progress' | 'completed' | 'abandoned';
  completedAt: number | null;
}

export function getCompletedStudyDays(sessions: StreakSession[], dayStartMinutes: number): string[] {
  const days = new Set<string>();
  for (const session of sessions) {
    if (session.status === 'completed' && session.completedAt !== null) {
      days.add(studyDayKey(session.completedAt, dayStartMinutes));
    }
  }
  return [...days].sort();
}

export function calculateStreakFromSessions(
  sessions: StreakSession[],
  now: number,
  dayStartMinutes: number
): number {
  const dayKeys = getCompletedStudyDays(sessions, dayStartMinutes);
  return calculateStreakFromDayKeys(dayKeys, now, dayStartMinutes);
}

export function calculateStreak(reviews: Array<{ timestamp: number }>, now: number, dayStartMinutes: number): number {
  if (reviews.length === 0) return 0;
  return calculateStreakFromDayKeys(reviews.map((review) => studyDayKey(review.timestamp, dayStartMinutes)), now, dayStartMinutes);
}

export function calculateStreakFromDayKeys(dayKeys: string[], now: number, dayStartMinutes: number): number {
  const uniqueDays = new Set(dayKeys);
  if (uniqueDays.size === 0) return 0;
  const today = studyDayKey(now, dayStartMinutes);
  const yesterday = previousDateKey(today);

  let cursor: string;
  if (uniqueDays.has(today)) {
    cursor = today;
  } else if (uniqueDays.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (uniqueDays.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

export function calculateLongestStreak(dayKeys: string[]): number {
  const sortedDays = [...new Set(dayKeys)].sort();
  let longest = 0;
  let current = 0;
  let previousDay = -1;

  for (const key of sortedDays) {
    const [year, month, day] = key.split('-').map(Number);
    const dayNumber = Math.round(Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000));
    current = dayNumber === previousDay + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDay = dayNumber;
  }

  return longest;
}

export type WeekStudyDay = {
  dayKey: string;
  label: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  isToday: boolean;
  isFuture: boolean;
  isCompleted: boolean;
};

export function getCurrentWeekStudyDays(
  completedDayKeys: Set<string> | string[],
  now: number,
  dayStartMinutes: number
): WeekStudyDay[] {
  const daySet = completedDayKeys instanceof Set ? completedDayKeys : new Set(completedDayKeys);
  const todayKey = studyDayKey(now, dayStartMinutes);
  const [year, month, day] = todayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);

  const labels: Array<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'> = [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  ];

  return labels.map((label, index) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + index);
    const dayKey = formatLocalDate(cur);
    return {
      dayKey,
      label,
      isToday: dayKey === todayKey,
      isFuture: dayKey > todayKey,
      isCompleted: daySet.has(dayKey)
    };
  });
}

export function isFirstCompletedSessionOfDay(
  sessions: Array<{ id: string; status: string; completedAt: number | null }>,
  targetSessionId: string,
  dayStartMinutes: number
): boolean {
  const target = sessions.find((s) => s.id === targetSessionId);
  if (!target || target.status !== 'completed' || target.completedAt === null) {
    return false;
  }
  const targetDay = studyDayKey(target.completedAt, dayStartMinutes);
  const otherCompletedEarlier = sessions.filter(
    (s) => s.id !== targetSessionId &&
      s.status === 'completed' &&
      s.completedAt !== null &&
      studyDayKey(s.completedAt, dayStartMinutes) === targetDay &&
      s.completedAt < (target.completedAt as number)
  );
  return otherCompletedEarlier.length === 0;
}

export type StreakCelebration = { oldStreak: number; newStreak: number };

/**
 * Decides whether finishing `targetSessionId` earns the streak celebration.
 * `sessions` must be loaded AFTER the target has been marked completed, and must hold every
 * completed session (not just recent ones) so long streaks are counted correctly.
 */
export function getStreakCelebration(
  sessions: Array<{ id: string; status: string; completedAt: number | null }>,
  targetSessionId: string,
  dayStartMinutes: number
): StreakCelebration | null {
  if (!isFirstCompletedSessionOfDay(sessions, targetSessionId, dayStartMinutes)) return null;
  const target = sessions.find((session) => session.id === targetSessionId);
  if (!target || target.completedAt === null) return null;
  const targetDay = studyDayKey(target.completedAt, dayStartMinutes);
  const otherDays = getCompletedStudyDays(
    sessions.filter((session) => session.id !== targetSessionId) as StreakSession[],
    dayStartMinutes
  );
  return {
    oldStreak: calculateStreakFromDayKeys(otherDays, target.completedAt, dayStartMinutes),
    newStreak: calculateStreakFromDayKeys([...otherDays, targetDay], target.completedAt, dayStartMinutes)
  };
}
