type StatCardProps = {
  label: string;
  value: string;
  tone?: 'orange' | 'indigo' | 'mint';
};

export function StatCard({ label, value, tone = 'indigo' }: StatCardProps) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
