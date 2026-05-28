'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) setAnalyses(data);
    } catch(err) {
      console.error('History error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = analyses.filter(a =>
    (a.resume_data?.candidateName || '')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function scoreColor(s) {
    return s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';
  }

  function recColor(r) {
    const map = {
      'Strong Hire': '#22c55e',
      'Hire': '#3b82f6',
      'Maybe': '#eab308',
      'Pass': '#ef4444'
    };
    return map[r] || '#6b7280';
  }

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0a1a',
      color:'white', padding:'24px'
    }}>
      <div style={{marginBottom:'24px'}}>
        <p style={{
          color:'rgba(255,255,255,0.4)',
          fontSize:'12px',
          letterSpacing:'0.1em',
          textTransform:'uppercase',
          marginBottom:'8px'
        }}>SESSION HISTORY</p>
        <h1 style={{fontSize:'32px',fontWeight:'700',margin:'0 0 8px'}}>
          Your analyses
        </h1>
        <p style={{color:'rgba(255,255,255,0.5)',fontSize:'14px'}}>
          {analyses.length} records found — loaded from Supabase
        </p>
      </div>

      <div style={{
        display:'flex',gap:'12px',
        marginBottom:'24px',flexWrap:'wrap'
      }}>
        <input
          type="text"
          placeholder="Search by candidate name..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex:1, minWidth:'200px',
            padding:'10px 16px',
            background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'8px', color:'white',
            fontSize:'14px', outline:'none'
          }}
        />
        <button
          onClick={loadHistory}
          style={{
            padding:'10px 20px',
            background:'rgba(255,255,255,0.1)',
            border:'1px solid rgba(255,255,255,0.2)',
            borderRadius:'8px', color:'white',
            cursor:'pointer', fontSize:'14px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'1fr 1.5fr',
        gap:'20px',
        alignItems:'start'
      }}>
        <div style={{
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'16px', overflow:'hidden'
        }}>
          {loading ? (
            <div style={{
              padding:'40px',textAlign:'center',
              color:'rgba(255,255,255,0.4)'
            }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding:'40px',textAlign:'center',
              color:'rgba(255,255,255,0.4)'
            }}>
              {searchQuery ? 'No results.' :
                'No analyses yet. Upload a resume first.'}
            </div>
          ) : filtered.map((item) => {
            const d = item.resume_data || {};
            const score = d.overallScore || 0;
            const isSelected = selected?.id === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  padding:'16px 20px',
                  borderBottom:'1px solid rgba(255,255,255,0.06)',
                  cursor:'pointer',
                  background: isSelected ?
                    'rgba(255,255,255,0.08)' : 'transparent'
                }}
              >
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  marginBottom:'6px'
                }}>
                  <span style={{fontWeight:'600',fontSize:'15px'}}>
                    {d.candidateName || 'Unknown'}
                  </span>
                  <span style={{
                    fontWeight:'700',fontSize:'16px',
                    color: scoreColor(score)
                  }}>{score}%</span>
                </div>
                <div style={{
                  fontSize:'12px',
                  color:'rgba(255,255,255,0.5)',
                  marginBottom:'6px'
                }}>{d.email || ''}</div>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between'
                }}>
                  <span style={{
                    fontSize:'11px',
                    padding:'2px 8px',
                    borderRadius:'20px',
                    background: recColor(d.hiringRecommendation)+'20',
                    color: recColor(d.hiringRecommendation),
                    border:`1px solid ${recColor(d.hiringRecommendation)}40`
                  }}>
                    {d.hiringRecommendation || 'Review'}
                  </span>
                  <span style={{
                    fontSize:'11px',
                    color:'rgba(255,255,255,0.3)'
                  }}>{formatDate(item.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'16px', padding:'24px',
          minHeight:'400px'
        }}>
          {!selected ? (
            <div style={{
              display:'flex', alignItems:'center',
              justifyContent:'center', height:'300px',
              color:'rgba(255,255,255,0.3)', fontSize:'14px'
            }}>
              Select an analysis to view details
            </div>
          ) : (
            <div>
              <h2 style={{
                fontSize:'22px',fontWeight:'700',
                margin:'0 0 4px'
              }}>
                {selected.resume_data?.candidateName}
              </h2>
              <p style={{
                color:'rgba(255,255,255,0.5)',
                fontSize:'13px', margin:'0 0 16px'
              }}>
                {selected.resume_data?.email}
                {selected.resume_data?.phone ? 
                  ` • ${selected.resume_data.phone}` : ''}
                {selected.resume_data?.experienceLevel ? 
                  ` • ${selected.resume_data.experienceLevel}` : ''}
              </p>

              <div style={{
                display:'flex',gap:'12px',
                flexWrap:'wrap',marginBottom:'20px'
              }}>
                <div style={{
                  padding:'8px 16px', borderRadius:'8px',
                  background: scoreColor(
                    selected.resume_data?.overallScore
                  )+'20',
                  border:`1px solid ${scoreColor(
                    selected.resume_data?.overallScore
                  )}40`,
                  color: scoreColor(selected.resume_data?.overallScore),
                  fontWeight:'700', fontSize:'18px'
                }}>
                  {selected.resume_data?.overallScore}% Score
                </div>
                <div style={{
                  padding:'8px 16px', borderRadius:'8px',
                  background:'rgba(255,255,255,0.06)',
                  fontSize:'13px',color:'rgba(255,255,255,0.7)'
                }}>
                  {selected.resume_data?.hiringRecommendation}
                </div>
              </div>

              {selected.resume_data?.profileSummary && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'12px',
                    color:'rgba(255,255,255,0.4)',
                    textTransform:'uppercase',
                    letterSpacing:'0.08em',
                    marginBottom:'6px'
                  }}>Profile Summary</p>
                  <p style={{
                    fontSize:'13px',lineHeight:'1.6',
                    color:'rgba(255,255,255,0.8)'
                  }}>
                    {selected.resume_data.profileSummary}
                  </p>
                </div>
              )}

              {selected.resume_data?.technicalSkills?.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'12px',
                    color:'rgba(255,255,255,0.4)',
                    textTransform:'uppercase',
                    letterSpacing:'0.08em',
                    marginBottom:'6px'
                  }}>Technical Skills</p>
                  <div style={{
                    display:'flex',flexWrap:'wrap',gap:'6px'
                  }}>
                    {selected.resume_data.technicalSkills
                      .map((s,i) => (
                      <span key={i} style={{
                        padding:'4px 10px',
                        background:'rgba(20,184,166,0.1)',
                        border:'1px solid rgba(20,184,166,0.3)',
                        borderRadius:'20px',
                        fontSize:'12px', color:'#14b8a6'
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.resume_data?.workExperience?.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'12px',
                    color:'rgba(255,255,255,0.4)',
                    textTransform:'uppercase',
                    letterSpacing:'0.08em',
                    marginBottom:'6px'
                  }}>Work Experience</p>
                  {selected.resume_data.workExperience
                    .map((job,i) => (
                    <div key={i} style={{
                      marginBottom:'10px',
                      paddingLeft:'12px',
                      borderLeft:'2px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{
                        fontWeight:'600',fontSize:'14px'
                      }}>{job.role}</div>
                      <div style={{
                        fontSize:'12px',
                        color:'rgba(255,255,255,0.5)',
                        marginBottom:'4px'
                      }}>
                        {job.company} • {job.duration}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selected.resume_data?.strengths?.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'12px',
                    color:'rgba(255,255,255,0.4)',
                    textTransform:'uppercase',
                    letterSpacing:'0.08em',
                    marginBottom:'6px'
                  }}>Strengths</p>
                  {selected.resume_data.strengths.map((s,i) => (
                    <div key={i} style={{
                      fontSize:'13px',
                      color:'#22c55e',
                      marginBottom:'4px'
                    }}>✓ {s}</div>
                  ))}
                </div>
              )}

              <button
                onClick={async () => {
                  const { generateAnalysisReport } = 
                    await import('@/lib/generateReport');
                  generateAnalysisReport(selected.resume_data);
                }}
                style={{
                  width:'100%', padding:'12px',
                  background:'white', color:'black',
                  border:'none', borderRadius:'8px',
                  cursor:'pointer', fontWeight:'600',
                  fontSize:'14px', marginTop:'8px'
                }}
              >
                ⬇️ Download PDF Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
