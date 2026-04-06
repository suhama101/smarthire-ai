const { getSupabaseClient } = require('./supabaseClient');

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function mapSupabaseError(error, fallbackMessage) {
  if (!error) {
    return null;
  }

  const message = error.message || fallbackMessage || 'Database operation failed.';
  const err = new Error(message);
  err.status = 500;
  err.code = 'DB_ERROR';
  err.details = error;
  return err;
}

async function saveAnalysis(userId, resumeData, rawText) {
  const supabase = getSupabaseClient();
  const analysis = {
    id: createId('analysis'),
    user_id: userId,
    resume_data: resumeData,
    raw_text: rawText,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('analyses')
    .insert(analysis)
    .select('*')
    .single();

  const mappedError = mapSupabaseError(error, 'Failed to save analysis.');
  if (mappedError) {
    throw mappedError;
  }

  return data;
}

async function getAnalysisById(id, userId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  const mappedError = mapSupabaseError(error, 'Failed to fetch analysis.');
  if (mappedError) {
    throw mappedError;
  }

  return data || null;
}

async function deleteAnalysisById(id, userId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('analyses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  const mappedError = mapSupabaseError(error, 'Failed to delete analysis.');
  if (mappedError) {
    throw mappedError;
  }

  return Boolean(data);
}

async function saveJobMatch(analysisId, userId, jobTitle, companyName, jobDescription, matchResult) {
  const supabase = getSupabaseClient();
  const jobMatch = {
    id: createId('match'),
    analysis_id: analysisId,
    user_id: userId,
    job_title: jobTitle,
    company_name: companyName,
    job_description: jobDescription,
    match_result: matchResult,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('job_matches')
    .insert(jobMatch)
    .select('*')
    .single();

  const mappedError = mapSupabaseError(error, 'Failed to save job match.');
  if (mappedError) {
    throw mappedError;
  }

  return data;
}

async function deleteJobMatchById(id, userId) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('job_matches')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  const mappedError = mapSupabaseError(error, 'Failed to delete job match.');
  if (mappedError) {
    throw mappedError;
  }

  return Boolean(data);
}

async function seedDemoDataIfEmpty(userId = 'demo-user') {
  const supabase = getSupabaseClient();

  const { count, error } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const mappedError = mapSupabaseError(error, 'Failed to check demo seed state.');
  if (mappedError) {
    throw mappedError;
  }

  if (Number(count || 0) > 0) {
    return { seeded: false };
  }

  const demoResumeData = {
    name: 'Demo Candidate',
    email: 'demo@example.com',
    title: 'Software Engineer',
    yearsExperience: 2,
    summary: 'Demo candidate profile generated for SmartHire AI Supabase setup validation.',
    technicalSkills: ['JavaScript', 'React', 'Node.js'],
    softSkills: ['Communication'],
    languages: ['JavaScript'],
    frameworks: ['React', 'Express'],
    databases: ['PostgreSQL'],
    tools: ['Git'],
    education: [],
    experience: [],
    certifications: [],
    keywords: ['React', 'Node.js', 'PostgreSQL'],
  };

  const analysis = await saveAnalysis(userId, demoResumeData, 'Demo resume raw text');
  return { seeded: true, analysisId: analysis.id };
}

module.exports = {
  saveAnalysis,
  getAnalysisById,
  deleteAnalysisById,
  saveJobMatch,
  deleteJobMatchById,
  seedDemoDataIfEmpty,
};