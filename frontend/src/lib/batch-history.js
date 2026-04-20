import { addBatchEntry, buildBatchCsv, clearHistory, readHistory, saveHistory } from './history-store';

export function readBatchRuns() {
  return readHistory().batches;
}

export function saveBatchRuns(runs) {
  const history = readHistory();
  return saveHistory({ ...history, batches: Array.isArray(runs) ? runs : [] });
}

export function addBatchRun(run) {
  return addBatchEntry(run);
}

export function clearBatchRuns() {
  return clearHistory();
}

export function computeBatchStats(runs) {
  const batches = Array.isArray(runs) ? runs : [];
  const totalResumes = batches.reduce((sum, batch) => sum + (Number(batch.totalResumes) || 0), 0);
  const averageScore = batches.length
    ? Math.round(batches.reduce((sum, batch) => sum + (Number(batch.avgScore ?? batch.averageScore) || 0), 0) / batches.length)
    : 0;

  return {
    totalResumes,
    averageScore,
    totalBatches: batches.length,
    resumesProcessedToday: batches.filter((batch) => {
      if (!batch.date && !batch.createdAt) {
        return false;
      }

      const batchDate = new Date(batch.date || batch.createdAt);
      const today = new Date();
      return batchDate.toDateString() === today.toDateString();
    }).reduce((sum, batch) => sum + (Number(batch.totalResumes) || 0), 0),
  };
}

export function getAverageScore(run) {
  return Number(run?.avgScore ?? run?.averageScore ?? 0);
}

export function getTopCandidate(run) {
  return run?.topCandidate || run?.results?.[0]?.candidateName || '--';
}

export function getTopSkillGap(run) {
  const results = Array.isArray(run?.results) ? run.results : [];
  const gapCounts = new Map();

  results.forEach((result) => {
    (result.missingSkills || result.skillGap || []).forEach((skill) => {
      gapCounts.set(skill, (gapCounts.get(skill) || 0) + 1);
    });
  });

  const topSkill = [...gapCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  return topSkill || '--';
}

export function buildBatchResultsCsv(results) {
  const rows = Array.isArray(results) ? results : [];
  const header = ['Rank', 'Candidate Name', 'Match Score', 'Missing Skills', 'Recommendation'];
  const lines = [header.join(',')];

  rows.forEach((result, index) => {
    const values = [
      result.rank || index + 1,
      result.candidateName || result.name || '--',
      `${result.matchScore || 0}%`,
      (result.missingSkills || result.skillGap || []).join('; '),
      result.recommendation || '--',
    ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

export function buildRunResultsCsv(run) {
  return buildBatchResultsCsv(Array.isArray(run?.results) ? run.results : []);
}

export function buildBatchName(run) {
  return run?.batchName || `${run?.companyName || 'Batch'} • ${run?.jobTitle || 'Role'}`;
}

export function buildBatchFilename(run) {
  const safeName = String(run?.batchName || run?.jobTitle || 'Batch_Results')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeName || 'Batch_Results'}.csv`;
}

export function buildReportFilename(batch) {
  const safeName = String(batch?.batchName || batch?.jobTitle || 'Batch_Report')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');

  return `${safeName || 'Batch_Report'}_Summary.pdf`;
}

export function formatBatchDate(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export { buildBatchCsv };
