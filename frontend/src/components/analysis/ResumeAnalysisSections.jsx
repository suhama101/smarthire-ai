function toText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter(Boolean);
}

function normalizeStringList(values) {
  return toArray(values)
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeExperienceItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const highlights = normalizeStringList(item.highlights || item.bullets || item.description);

  return {
    title: toText(item.title || item.role || item.position, 'Role not specified'),
    company: toText(item.company || item.organization || item.employer, 'Company not specified'),
    duration: toText(item.duration || item.period || item.range, ''),
    highlights,
  };
}

function normalizeEducationItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  return {
    degree: toText(item.degree || item.qualification || item.program, 'Education details not specified'),
    institution: toText(item.institution || item.school || item.university, 'Institution not specified'),
    year: toText(item.year || item.graduationYear || item.completed, ''),
  };
}

function normalizeProjectItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  return {
    name: toText(item.name || item.title || item.projectName, 'Project'),
    description: toText(item.description || item.summary || item.details, ''),
    technologies: normalizeStringList(item.technologies || item.techStack || item.tools),
  };
}

function formatExperienceLabel(value) {
  const years = toNumber(value);

  if (years === null) {
    return toText(value, 'Experience not specified');
  }

  if (years === 0) {
    return 'Entry level';
  }

  return `${years} year${years === 1 ? '' : 's'} experience`;
}

function inferExperienceLevel(yearsExperience) {
  const years = toNumber(yearsExperience);

  if (years === null) {
    return 'Not specified';
  }

  if (years < 2) {
    return 'Entry';
  }

  if (years < 5) {
    return 'Mid-level';
  }

  if (years < 9) {
    return 'Senior';
  }

  return 'Lead';
}

function normalizeAnalysis(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const technicalSkills = normalizeStringList(data.technicalSkills || data.skills);
  const softSkills = normalizeStringList(data.softSkills);
  const languages = normalizeStringList(data.languages);
  const frameworks = normalizeStringList(data.frameworks);
  const databases = normalizeStringList(data.databases);
  const tools = normalizeStringList(data.tools);
  const workExperience = toArray(data.workExperience || data.experience)
    .map(normalizeExperienceItem)
    .filter(Boolean);
  const education = toArray(data.education)
    .map(normalizeEducationItem)
    .filter(Boolean);
  const projects = toArray(data.projects)
    .map(normalizeProjectItem)
    .filter(Boolean);

  const yearsExperience = toNumber(data.yearsExperience ?? data.totalExperience);
  const overallScore = toNumber(data.overallScore ?? data.score ?? data.matchScore);

  return {
    candidateName: toText(data.candidateName || data.name, 'Unknown Candidate'),
    email: toText(data.email, ''),
    phone: toText(data.phone, ''),
    experienceLevel: toText(data.experienceLevel, inferExperienceLevel(yearsExperience)),
    totalExperience: toText(data.totalExperience, formatExperienceLabel(yearsExperience)),
    profileSummary: toText(data.profileSummary || data.summary, 'No summary was extracted.'),
    technicalSkills,
    softSkills,
    languages,
    frameworks,
    databases,
    tools,
    workExperience,
    education,
    projects,
    strengths: normalizeStringList(data.strengths),
    areasToImprove: normalizeStringList(data.areasToImprove || data.gaps),
    overallScore,
    hiringRecommendation: toText(data.hiringRecommendation || data.recommendation, 'Review manually'),
  };
}

function chipClassName(kind) {
  if (kind === 'positive') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (kind === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (kind === 'danger') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-white/10 bg-white/5 text-[#F1F1F3]';
}

function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-[#0B0B10] p-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-[#B7B7C6]">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ScoreRing({ score }) {
  const numericScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
  const tone = numericScore === null
    ? 'border-white/10 bg-white/5 text-[#F1F1F3]'
    : numericScore >= 80
      ? 'border-emerald-200 bg-emerald-500/10 text-emerald-200'
      : numericScore >= 60
        ? 'border-amber-200 bg-amber-500/10 text-amber-200'
        : 'border-rose-200 bg-rose-500/10 text-rose-200';

  return (
    <div className={`flex h-24 w-24 items-center justify-center rounded-full border text-center ${tone}`}>
      <div>
        <p className="text-2xl font-semibold leading-none">{numericScore === null ? 'N/A' : `${numericScore}%`}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em]">Score</p>
      </div>
    </div>
  );
}

function SkillGroup({ label, items, tone = 'default' }) {
  if (!items.length) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={`${label}-${item}`} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${chipClassName(tone)}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ResumeAnalysisSections({ analysis }) {
  const data = normalizeAnalysis(analysis);

  if (!analysis) {
    return null;
  }

  return (
    <div className="mt-5 space-y-4">
      <SectionCard title="Candidate Header" className="border-white/15 bg-[#0E0E14]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-white">{data.candidateName}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-[#B7B7C6]">
              <span>{data.email || 'No email extracted'}</span>
              {data.phone ? <span>• {data.phone}</span> : null}
              <span>• {data.totalExperience}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${chipClassName('warning')}`}>
                {data.experienceLevel}
              </span>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${chipClassName('positive')}`}>
                {data.hiringRecommendation}
              </span>
            </div>
          </div>
          <ScoreRing score={data.overallScore} />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Profile Summary" subtitle="A concise AI-generated readout of the resume" className="xl:col-span-2">
          <p className="text-sm leading-6 text-[#F1F1F3]">{data.profileSummary}</p>
        </SectionCard>

        <SectionCard title="Skills" subtitle="Grouped from the structured extraction">
          <div className="space-y-4">
            <SkillGroup label="Technical" items={data.technicalSkills} tone="positive" />
            <SkillGroup label="Soft" items={data.softSkills} tone="warning" />
            <SkillGroup label="Languages" items={data.languages} />
            <SkillGroup label="Frameworks" items={data.frameworks} />
            <SkillGroup label="Databases" items={data.databases} />
            <SkillGroup label="Tools" items={data.tools} />
            {!data.technicalSkills.length && !data.softSkills.length && !data.languages.length && !data.frameworks.length && !data.databases.length && !data.tools.length ? (
              <p className="text-sm text-[#8B8B9E]">No skills were extracted.</p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Work Experience" subtitle="Roles, employers, and key impact">
          <div className="space-y-4">
            {data.workExperience.length ? data.workExperience.map((item, index) => (
              <article key={`${item.title}-${item.company}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="text-sm text-[#B7B7C6]">{item.company}</p>
                  </div>
                  {item.duration ? <p className="text-sm text-[#8B8B9E]">{item.duration}</p> : null}
                </div>
                {item.highlights.length ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[#F1F1F3]">
                    {item.highlights.map((highlight, highlightIndex) => (
                      <li key={`${item.title}-${highlightIndex}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            )) : <p className="text-sm text-[#8B8B9E]">No work experience was extracted.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Education" subtitle="Degrees, institutions, and completion dates">
          <div className="space-y-3">
            {data.education.length ? data.education.map((item, index) => (
              <article key={`${item.degree}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">{item.degree}</p>
                <p className="mt-1 text-sm text-[#B7B7C6]">{item.institution}</p>
                {item.year ? <p className="mt-2 text-sm text-[#8B8B9E]">{item.year}</p> : null}
              </article>
            )) : <p className="text-sm text-[#8B8B9E]">No education entries were extracted.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Projects" subtitle="Side work, portfolio, or product examples" className="xl:col-span-2">
          <div className="grid gap-3 lg:grid-cols-2">
            {data.projects.length ? data.projects.map((item, index) => (
              <article key={`${item.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">{item.name}</p>
                {item.description ? <p className="mt-2 text-sm leading-6 text-[#B7B7C6]">{item.description}</p> : null}
                {item.technologies.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.technologies.map((technology) => (
                      <span key={`${item.name}-${technology}`} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${chipClassName('default')}`}>
                        {technology}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            )) : <p className="text-sm text-[#8B8B9E]">No projects were extracted.</p>}
          </div>
        </SectionCard>

        <SectionCard title="Insights" subtitle="Model summary and gaps to review" className="xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Strengths</p>
              <div className="mt-3 space-y-2">
                {data.strengths.length ? data.strengths.map((item) => (
                  <div key={item} className={`rounded-2xl border px-3 py-2 text-sm ${chipClassName('positive')}`}>
                    {item}
                  </div>
                )) : <p className="text-sm text-[#8B8B9E]">No strengths were extracted.</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Areas to Improve</p>
              <div className="mt-3 space-y-2">
                {data.areasToImprove.length ? data.areasToImprove.map((item) => (
                  <div key={item} className={`rounded-2xl border px-3 py-2 text-sm ${chipClassName('warning')}`}>
                    {item}
                  </div>
                )) : <p className="text-sm text-[#8B8B9E]">No gaps were extracted.</p>}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#050507] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Hiring Recommendation</p>
            <p className="mt-2 text-sm leading-6 text-[#F1F1F3]">{data.hiringRecommendation}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export { normalizeAnalysis };
