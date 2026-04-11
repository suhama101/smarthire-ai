const express = require('express');
const { getSupabaseClient } = require('../services/supabaseClient');

const router = express.Router();

router.get('/db', async (req, res, next) => {
  try {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      return res.status(404).json({ error: 'Not found' });
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 5, 20));
    const supabase = getSupabaseClient();

    const [users, analyses, jobMatches] = await Promise.all([
      supabase
        .from('users')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('analyses')
        .select('id, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('job_matches')
        .select('id, analysis_id, user_id, job_title, company_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    return res.json({
      source: supabase.__isMemory ? 'memory' : 'supabase',
      users: users.data || [],
      analyses: analyses.data || [],
      jobMatches: jobMatches.data || [],
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;