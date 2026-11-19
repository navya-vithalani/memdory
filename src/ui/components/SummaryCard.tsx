import { Link } from 'react-router-dom';
import { Mnemo } from './Mnemo';

type SummaryCardProps = {
  sessionCount: number;
};

export function SummaryCard({ sessionCount }: SummaryCardProps) {
  const message = sessionCount === 0
    ? 'Finish a few sessions and I’ll start spotting patterns.'
    : `You’ve started ${sessionCount} session${sessionCount === 1 ? '' : 's'} so far. Every one helps you remember more.`;
  return (
    <section className="nemo-summary">
      <Mnemo mood="happy" />
      <div>
        <p className="nemo-bubble">{message}</p>
        <Link to="/analysis" className="nemo-link">See full analysis →</Link>
      </div>
    </section>
  );
}
