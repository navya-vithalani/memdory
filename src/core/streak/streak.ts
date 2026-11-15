function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const uniqueDays = new Set(reviews.map((review) => studyDayKey(review.timestamp, dayStartMinutes)));
  const today = studyDayKey(now, dayStartMinutes);
  const [year, month, day] = (uniqueDays.has(today) ? today : (() => {
    const previous = new Date(now);
    previous.setDate(previous.getDate() - 1);
    return formatLocalDate(previous);
  })()).split('-').map(Number);
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
