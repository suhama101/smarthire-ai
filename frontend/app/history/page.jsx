'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setAnalyses(data || []);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filtered = analyses.filter(a =>
    (a.resume_data?.candidateName || '')
      .toLowerCase().includes(search.toLowerCase())
  );

  const scoreColor = s => 
    s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';

  return (
    <div style={{
      minHeight:'100vh', background:'#0a0a1a',
      color:'white', padding:'24px'
    }}>
      <p style={{
        color:'rgba(255,255,255,0.4)', fontSize:'12px',
        letterSpacing:'0.1em', textTransform:'uppercase',
        marginBottom:'8px'
      }}>SESSION HISTORY</p>
      
      <h1 style={{
        fontSize:'32px', fontWeight:'700', margin:'0 0 8px'
      }}>Your analyses</h1>
      
      <p style={{
        color:'rgba(255,255,255,0.5)',
        fontSize:'14px', marginBottom:'24px'
      }}>
        {analyses.length} records — loaded from Supabase
      </p>

      <div style={{
        display:'flex', gap:'12px', marginBottom:'24px'
      }}>
        <input
          placeholder="Search by candidate name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex:1, padding:'10px 16px',
            background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.1)',
            borderRadius:'8px', color:'white',
            fontSize:'14px', outline:'none'
          }}
        />
        <button onClick={load} style={{
          padding:'10px 20px',
          background:'rgba(255,255,255,0.1)',
          border:'1px solid rgba(255,255,255,0.2)',
          borderRadius:'8px', color:'white',
          cursor:'pointer'
        }}>🔄 Refresh</button>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'1fr 1.5fr',
        gap:'20px'
      }}>
        <div style={{
          background:'rgba(255,255,255,0.03)',
          border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:'16px', overflow:'hidden'
        }}>
          {loading ? (
            <div style={{
              padding:'40px', textAlign:'center',
              color:'rgba(255,255,255,0.4)'
            }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding:'40px', textAlign:'center',
              color:'rgba(255,255,255,0.4)'
            }}>
              No analyses yet. Upload a resume first.
            </div>
          ) : filtered.map(item => {
            const d = item.resume_data || {};
            const score = d.overallScore || 0;
            return (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                style={{
                  padding:'16px 20px',
                  borderBottom:'1px solid rgba(255,255,255,0.06)',
                  cursor:'pointer',
                  background: selected?.id === item.id ?
                    'rgba(255,255,255,0.08)' : 'transparent'
                }}
              >
                <div style={{
                  display:'flex',
                  justifyContent:'space-between',
                  marginBottom:'4px'
                }}>
                  <span style={{fontWeight:'600'}}>
                    {d.candidateName || 'Unknown'}
                  </span>
                  <span style={{
                    color: scoreColor(score),
                    fontWeight:'700'
                  }}>{score}%</span>
                </div>
                <div style={{
                  fontSize:'12px',
                  color:'rgba(255,255,255,0.5)',
                  marginBottom:'4px'
                }}>{d.email || ''}</div>
                <div style={{
                  display:'flex',
                  justifyContent:'space-between'
                }}>
                  <span style={{
                    fontSize:'11px', padding:'2px 8px',
                    borderRadius:'20px',
                    background:'rgba(255,255,255,0.1)',
                    color:'rgba(255,255,255,0.6)'
                  }}>
                    {d.hiringRecommendation || 'Review'}
                  </span>
                  <span style={{
                    fontSize:'11px',
                    color:'rgba(255,255,255,0.3)'
                  }}>
                    {new Date(item.created_at)
                      .toLocaleDateString()}
                  </span>
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
              color:'rgba(255,255,255,0.3)'
            }}>
              Select an analysis to view details
            </div>
          ) : (
            <div>
              <h2 style={{fontSize:'20px', fontWeight:'700',
                margin:'0 0 8px'}}>
                {selected.resume_data?.candidateName}
              </h2>
              <p style={{
                color:'rgba(255,255,255,0.5)',
                fontSize:'13px', marginBottom:'16px'
              }}>
                {selected.resume_data?.email}
                {selected.resume_data?.experienceLevel &&
                  ` • ${selected.resume_data.experienceLevel}`}
              </p>
              
              <div style={{
                display:'flex', gap:'8px',
                marginBottom:'20px', flexWrap:'wrap'
              }}>
                <span style={{
                  padding:'6px 14px', borderRadius:'8px',
                  background: scoreColor(
                    selected.resume_data?.overallScore
                  )+'20',
                  color: scoreColor(
                    selected.resume_data?.overallScore
                  ),
                  fontWeight:'700', fontSize:'16px'
                }}>
                  {selected.resume_data?.overallScore}%
                </span>
                <span style={{
                  padding:'6px 14px', borderRadius:'8px',
                  background:'rgba(255,255,255,0.06)',
                  fontSize:'13px'
                }}>
                  {selected.resume_data?.hiringRecommendation}
                </span>
              </div>

              {selected.resume_data?.profileSummary && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'11px', textTransform:'uppercase',
                    color:'rgba(255,255,255,0.4)',
                    marginBottom:'6px'
                  }}>Summary</p>
                  <p style={{
                    fontSize:'13px', lineHeight:'1.6',
                    color:'rgba(255,255,255,0.7)'
                  }}>
                    {selected.resume_data.profileSummary}
                  </p>
                </div>
              )}

              {selected.resume_data?.technicalSkills?.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'11px', textTransform:'uppercase',
                    color:'rgba(255,255,255,0.4)',
                    marginBottom:'6px'
                  }}>Skills</p>
                  <div style={{
                    display:'flex', flexWrap:'wrap', gap:'6px'
                  }}>
                    {selected.resume_data.technicalSkills
                      .map((s,i) => (
                      <span key={i} style={{
                        padding:'3px 8px',
                        background:'rgba(20,184,166,0.1)',
                        border:'1px solid rgba(20,184,166,0.3)',
                        borderRadius:'20px',
                        fontSize:'11px', color:'#14b8a6'
                      }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.resume_data?.workExperience?.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <p style={{
                    fontSize:'11px', textTransform:'uppercase',
                    color:'rgba(255,255,255,0.4)',
                    marginBottom:'6px'
                  }}>Experience</p>
                  {selected.resume_data.workExperience
                    .map((job,i) => (
                    <div key={i} style={{
                      marginBottom:'8px', paddingLeft:'10px',
                      borderLeft:'2px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{
                        fontWeight:'600', fontSize:'13px'
                      }}>{job.role}</div>
                      <div style={{
                        fontSize:'12px',
                        color:'rgba(255,255,255,0.5)'
                      }}>
                        {job.company} • {job.duration}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
