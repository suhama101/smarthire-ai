'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const PIE_COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

const chartStyles = {
  background: '#1a1a24',
  border: '1px solid #2a2a38',
  borderRadius: 16,
};

export default function SkillsPieChart({ data = [] }) {
  return (
    <div className="h-80 w-full">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={chartStyles} labelStyle={{ color: '#f1f1f3', fontWeight: 600 }} />
            <Legend wrapperStyle={{ color: '#f1f1f3' }} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={115}
              innerRadius={60}
              paddingAngle={2}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          No top skills data available.
        </div>
      )}
    </div>
  );
}
