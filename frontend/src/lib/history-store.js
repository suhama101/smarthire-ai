const STORAGE_KEY = 'smarthire_history';

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function normalizeHistory(history) {
  const safeHistory = history && typeof history === 'object' ? history : {};

  return {
    analyses: Array.isArray(safeHistory.analyses) ? safeHistory.analyses : [],
    batches: Array.isArray(safeHistory.batches) ? safeHistory.batches : [],
  };
}

export function readHistory() {
  const storage = getStorage();

  if (!storage) {
    return { analyses: [], batches: [] };
  }

  const history = normalizeHistory(safeParse(storage.getItem(STORAGE_KEY), { analyses: [], batches: [] }));

  if (!history.batches.length) {
    const legacyBatches = safeParse(storage.getItem('smarthire.batch.runs'), []);
    if (Array.isArray(legacyBatches) && legacyBatches.length) {
      history.batches = legacyBatches.map((batch) => ({
        id: batch.id || `batch-${batch.createdAt || Date.now()}`,
        date: batch.date || batch.createdAt || new Date().toISOString(),
        jobTitle: batch.jobTitle || batch.batchName || 'Batch run',
        companyName: batch.companyName || '',
        totalResumes: Number.isFinite(Number(batch.totalResumes)) ? Number(batch.totalResumes) : 0,
        avgScore: Number.isFinite(Number(batch.avgScore ?? batch.averageScore)) ? Number(batch.avgScore ?? batch.averageScore) : 0,
        topCandidate: batch.topCandidate || '--',
        results: Array.isArray(batch.results) ? batch.results : [],
      }));
    }
  }

  return history;
}

export function saveHistory(history) {
  const storage = getStorage();

  if (!storage) {
    return { analyses: [], batches: [] };
  }

  const normalized = normalizeHistory(history);
  storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event('smarthire-history-changed'));
  return normalized;
}

export function clearHistory() {
  const storage = getStorage();

  if (!storage) {
    return { analyses: [], batches: [] };
  }

  storage.removeItem(STORAGE_KEY);
  storage.removeItem('smarthire.batch.runs');
  window.dispatchEvent(new Event('smarthire-history-changed'));
  return { analyses: [], batches: [] };
}

export function addAnalysisEntry(entry) {
  const history = readHistory();
  const nextEntry = {
    id: entry?.id || `analysis-${Date.now()}`,
    date: entry?.date || new Date().toISOString(),
    resumeFilename: String(entry?.resumeFilename || 'Resume').trim(),
    jobTitle: String(entry?.jobTitle || 'Unmatched Role').trim(),
    matchScore: Number.isFinite(Number(entry?.matchScore)) ? Math.max(0, Math.min(100, Math.round(Number(entry.matchScore)))) : 0,
    recommendation: String(entry?.recommendation || '').trim(),
    fullResult: entry?.fullResult || null,
  };

  const analyses = [nextEntry, ...history.analyses.filter((item) => item.id !== nextEntry.id)];
  return saveHistory({ ...history, analyses });
}

export function addBatchEntry(entry) {
  const history = readHistory();
  const nextEntry = {
    id: entry?.id || `batch-${Date.now()}`,
    date: entry?.date || new Date().toISOString(),
    jobTitle: String(entry?.jobTitle || 'Batch Review').trim(),
    companyName: String(entry?.companyName || '').trim(),
    totalResumes: Number.isFinite(Number(entry?.totalResumes)) ? Math.max(0, Math.round(Number(entry.totalResumes))) : 0,
    avgScore: Number.isFinite(Number(entry?.avgScore)) ? Math.max(0, Math.min(100, Math.round(Number(entry.avgScore)))) : 0,
    topCandidate: String(entry?.topCandidate || '--').trim(),
    results: Array.isArray(entry?.results) ? entry.results : [],
  };

  const batches = [nextEntry, ...history.batches.filter((item) => item.id !== nextEntry.id)];
  return saveHistory({ ...history, batches });
}

export function buildAnalysisCsv(analyses) {
  const rows = Array.isArray(analyses) ? analyses : [];
  const header = ['Date & Time', 'Resume Filename', 'Job Title Matched Against', 'Match Score', 'Recommendation'];
  const lines = [header.join(',')];

  rows.forEach((analysis) => {
    const values = [analysis.date, analysis.resumeFilename, analysis.jobTitle, `${analysis.matchScore}%`, analysis.recommendation]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  });

  return lines.join('\n');
}

export function buildBatchCsv(batches) {
  const rows = Array.isArray(batches) ? batches : [];
  const header = ['Date & Time', 'Job Title', 'Company Name', 'Total Resumes Processed', 'Average Match Score', 'Top Candidate Name'];
  const lines = [header.join(',')];

  rows.forEach((batch) => {
    const values = [batch.date, batch.jobTitle, batch.companyName, batch.totalResumes, `${batch.avgScore}%`, batch.topCandidate]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`);
    lines.push(values.join(','));
  });

  return lines.join('\n');
}
