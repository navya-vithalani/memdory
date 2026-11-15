import { useId } from 'react';

type WeeklyStreakProps = {
  streak: number;
  reviewedToday: boolean;
};

export function WeeklyStreak({ streak, reviewedToday }: WeeklyStreakProps) {
  const clipPrefix = useId().replaceAll(':', '');
  const filledDays = Math.min(7, streak);
  const lastStudyDate = new Date();
  if (!reviewedToday) lastStudyDate.setDate(lastStudyDate.getDate() - 1);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(lastStudyDate);
    date.setDate(date.getDate() - 6 + index);
    return {
      label: new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date),
      date: date.getDate()
    };
  });

  return (
    <section className="weekly-streak" aria-label={`${streak}-day study streak`}>
      <div className="weekly-streak-copy">
        <span className="eyebrow">Keep your current flowing</span>
        <strong>{streak} <small>{streak === 1 ? 'day' : 'days'} in a row</small></strong>
      </div>
      <div className="streak-drops">
        {days.map(({ label, date }, index) => {
          const filled = index >= days.length - filledDays;
          const clipId = `${clipPrefix}-drop-${index}`;
          return (
            <div className={`streak-drop${filled ? ' filled' : ''}`} key={`${date}-${index}`} title={`${label} ${date}${filled ? ' · streak day' : ''}`}>
              <svg viewBox="0 0 32 40" aria-hidden="true">
                <defs><clipPath id={clipId}><path d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" /></clipPath></defs>
                <path className="drop-outline" d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" />
                <g clipPath={`url(#${clipId})`} className="drop-water" style={{ ['--water-level' as string]: filled ? '0px' : '28px' }}>
                  <rect x="0" y="12" width="32" height="28" />
                  <path d="M0 13c4-3 8-3 12 0s8 3 12 0 8-3 12 0v5H0Z" />
                </g>
                <path className="drop-shine" d="M10 24c.4-3.1 2.2-5.4 4.5-7" />
              </svg>
              <span>{label}{date}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
