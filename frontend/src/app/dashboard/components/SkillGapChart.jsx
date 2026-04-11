'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const chartStyles = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
};

export default function SkillGapChart({ data = [] }) {
  return (
    <div className="h-80 w-full">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartStyles} labelStyle={{ color: '#0f172a', fontWeight: 600 }} />
            <Legend />
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
