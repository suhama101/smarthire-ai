'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const chartStyles = {
  background: '#1a1a24',
  border: '1px solid #2a2a38',
  borderRadius: 16,
};

export default function SkillGapChart({ data = [] }) {
  return (
    <div className="h-80 w-full">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a38" />
            <XAxis dataKey="label" stroke="#8b8b9e" tickLine={false} axisLine={false} />
            <YAxis stroke="#8b8b9e" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartStyles} labelStyle={{ color: '#f1f1f3', fontWeight: 600 }} />
            <Legend wrapperStyle={{ color: '#f1f1f3' }} />
            <Bar dataKey="count" name="Skill gaps" fill="#334155" radius={[12, 12, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          No skill gap distribution available.
        </div>
      )}
    </div>
  );
}
