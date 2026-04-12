'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, FileText, Sparkles } from 'lucide-react';
import { Badge, Button, Card, EmptyState } from '../../src/components/ui';

const ANALYSES = [
  { id: 'AN-1024', name: 'Amina Khan', role: 'Frontend Engineer', score: 92, status: 'Matched', date: '2026-04-11' },
  { id: 'AN-1023', name: 'Daniel Kim', role: 'Product Designer', score: 84, status: 'Reviewed', date: '2026-04-10' },
  { id: 'AN-1022', name: 'Sara Lopez', role: 'Data Analyst', score: 67, status: 'In Progress', date: '2026-04-10' },
  { id: 'AN-1021', name: 'Omar Ali', role: 'Backend Engineer', score: 58, status: 'Needs Review', date: '2026-04-09' },
  { id: 'AN-1020', name: 'Maya Roy', role: 'Recruiter Screen', score: 76, status: 'Matched', date: '2026-04-08' },
  { id: 'AN-1019', name: 'Noah Patel', role: 'QA Engineer', score: 61, status: 'Reviewed', date: '2026-04-08' },
  { id: 'AN-1018', name: 'Emily Stone', role: 'Growth Marketer', score: 88, status: 'Matched', date: '2026-04-07' },
  { id: 'AN-1017', name: 'Hassan Noor', role: 'ML Engineer', score: 53, status: 'Needs Review', date: '2026-04-07' },
];

const PAGE_SIZE = 5;

function statusTone(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

export default function HistoryPage() {
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    const rows = [...ANALYSES].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const compare = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
      return sortDirection === 'asc' ? compare : -compare;
    });

    return rows;
  }, [sortDirection, sortKey]);

  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const visibleRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('desc');
  }

  return (
    <div className="space-y-6">
      <Card
        header={
          <div className="flex items-center gap-2 text-sm font-medium text-[#8B8B9E]">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            Analysis history
          </div>
        }
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B8B9E]">History</p>
            <h1 className="mt-2 text-3xl font-bold text-[#F1F1F3]">Resume analysis history</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8B8B9E]">
              Review past analyses, sort results, and track how candidate fit has evolved over time.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#8B8B9E]">
            <Badge value={sortedRows.length}>{sortedRows.length} analyses</Badge>
          </div>
        </div>
      </Card>

      <Card>
        {visibleRows.length ? (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-[#0F0F13] text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">
                <tr>
                  <th className="px-4 py-3">
                    <button className="inline-flex items-center gap-2 font-semibold" onClick={() => toggleSort('id')}>
                      Analysis ID <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button className="inline-flex items-center gap-2 font-semibold" onClick={() => toggleSort('name')}>
                      Candidate <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button className="inline-flex items-center gap-2 font-semibold" onClick={() => toggleSort('role')}>
                      Role <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button className="inline-flex items-center gap-2 font-semibold" onClick={() => toggleSort('score')}>
                      Score <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button className="inline-flex items-center gap-2 font-semibold" onClick={() => toggleSort('date')}>
                      Date <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#1A1A24]">
                {visibleRows.map((row) => (
                  <tr key={row.id} className="transition duration-200 ease-in-out hover:bg-white/5">
                    <td className="px-4 py-4 font-medium text-[#F1F1F3]">{row.id}</td>
                    <td className="px-4 py-4 text-[#F1F1F3]">{row.name}</td>
                    <td className="px-4 py-4 text-[#8B8B9E]">{row.role}</td>
                    <td className="px-4 py-4">
                      <Badge value={row.score}>{row.score}%</Badge>
                    </td>
                    <td className="px-4 py-4 text-[#8B8B9E]">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="No history yet"
            message="Once analyses are available, they will appear in this table with sortable columns and score badges."
            action={<Button variant="primary">Run your first analysis</Button>}
          />
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-[#8B8B9E]">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
