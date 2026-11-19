import { useId, useMemo } from 'react';
import { getCurrentWeekStudyDays } from '../../core/streak/streak';

type WeeklyStreakProps = {
  streak: number;
  completedDayKeys?: string[];
  dayStartMinutes?: number;
};

export function WeeklyStreak({
  streak,
  completedDayKeys = [],
  dayStartMinutes = 210
}: WeeklyStreakProps) {
  const clipPrefix = useId().replaceAll(':', '');
  const now = useMemo(() => Date.now(), []);
  const days = useMemo(
    () => getCurrentWeekStudyDays(completedDayKeys, now, dayStartMinutes),
    [completedDayKeys, now, dayStartMinutes]
  );

  return (
    <section className="weekly-streak" aria-label={`${streak}-day study streak`}>
      <div className="weekly-streak-copy">
        <span className="eyebrow">Keep your current flowing</span>
        <strong>
          {streak} <small>{streak === 1 ? 'day' : 'days'} in a row</small>
        </strong>
      </div>
      <div className="weekly-streak-drops" role="group" aria-label="Current week study days">
        {days.map((day, index) => {
          const clipId = `${clipPrefix}-drop-${index}`;
          const classes = [
            'weekly-streak-drop',
            day.isCompleted ? 'is-completed' : '',
            day.isToday ? 'is-today' : '',
            day.isFuture ? 'is-future' : ''
          ].filter(Boolean).join(' ');

          const title = `${day.label}${day.isToday ? ' (Today)' : ''}: ${day.isCompleted ? 'Completed' : day.isFuture ? 'Upcoming' : 'Missed'}`;

          return (
            <div className={classes} key={day.dayKey} title={title}>
              <svg className="drop-svg" viewBox="0 0 32 40" aria-hidden="true">
                <defs>
                  <clipPath id={clipId}>
                    <path d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" />
                  </clipPath>
                </defs>
                <path className="drop-outline" d="M16 2C13 8 4 17 4 25a12 12 0 0 0 24 0C28 17 19 8 16 2Z" />
                {day.isCompleted && (
                  <g clipPath={`url(#${clipId})`}>
                    <g className="drop-water-wrapper">
                      <path
                        className="drop-wave wave-1"
                        d="M -32 0 Q -16 -3 0 0 Q 16 3 32 0 Q 48 -3 64 0 V 40 H -32 Z"
                      />
                      <path
                        className="drop-wave wave-2"
                        d="M -32 1 Q -16 4 0 1 Q 16 -2 32 1 Q 48 4 64 1 V 40 H -32 Z"
                      />
                    </g>
                    <path className="drop-shine" d="M10 24c.4-3.1 2.2-5.4 4.5-7" />
                  </g>
                )}
              </svg>
              <span className="drop-day-label">{day.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
