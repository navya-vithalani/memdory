function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - 1);
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

export function calculateStreak(reviews: Array<{ timestamp: number }>, now: number, dayStartMinutes: number): number {
  if (reviews.length === 0) return 0;
  return calculateStreakFromDayKeys(reviews.map((review) => studyDayKey(review.timestamp, dayStartMinutes)), now, dayStartMinutes);
}

export function calculateStreakFromDayKeys(dayKeys: string[], now: number, dayStartMinutes: number): number {
  const uniqueDays = new Set(dayKeys);
  if (uniqueDays.size === 0) return 0;
  const today = studyDayKey(now, dayStartMinutes);
  const [year, month, day] = (uniqueDays.has(today) ? today : previousDateKey(today)).split('-').map(Number);
  const cursor = new Date(year, month - 1, day, 12);
  let streak = 0;

  for (let index = 0; index < 365; index += 1) {
    const dayKey = formatLocalDate(cursor);
    if (uniqueDays.has(dayKey)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
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
    const dayNumber = Date.UTC(year, month - 1, day) / (24 * 60 * 60 * 1000);
    current = dayNumber === previousDay + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousDay = dayNumber;
  }

  return longest;
}
