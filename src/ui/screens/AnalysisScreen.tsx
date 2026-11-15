import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Easy', value: 40 },
  { name: 'Medium', value: 35 },
  { name: 'Hard', value: 15 },
  { name: 'Blank', value: 10 }
];

const COLORS = ['#1FB58F', '#4A7BF7', '#F2B134', '#8A93B8'];

export function AnalysisScreen() {
  return (
    <main className="screen">
      <h1>Analysis</h1>
      <div className="chart-panel">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={4}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}
