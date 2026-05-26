import jsPDF from 'jspdf';

function toTextList(values, separator = ' • ') {
  if (!Array.isArray(values)) {
    return '';
  }

  return values
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean)
    .join(separator);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc, currentY, requiredHeight) {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (currentY + requiredHeight > pageHeight - 18) {
    doc.addPage();
    return 20;
  }

  return currentY;
}

function addSectionTitle(doc, title, x, y, maxWidth) {
  const nextY = ensureSpace(doc, y, 16);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, nextY);
  return nextY + 6;
}

export function generateAnalysisReport(analysis, jobMatch = null) {
  const data = analysis && typeof analysis === 'object' ? analysis : {};
  const match = jobMatch && typeof jobMatch === 'object' ? jobMatch : null;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFillColor(15, 15, 30);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SmartHire AI', marginX, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Candidate Analysis Report', marginX, 28);
  doc.text(
    new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    marginX,
    36
  );

  doc.setTextColor(0, 0, 0);
  let y = 55;

  y = ensureSpace(doc, y, 24);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(String(data.candidateName || data.name || 'Unknown Candidate'), marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  if (data.email) {
    doc.text(`Email: ${data.email}`, marginX, y);
    y += 6;
  }
  if (data.phone) {
    doc.text(`Phone: ${data.phone}`, marginX, y);
    y += 6;
  }
  if (data.location) {
    doc.text(`Location: ${data.location}`, marginX, y);
    y += 6;
  }
  y += 4;

  const score = Number(data.overallScore) || 0;
  const scoreColor = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : [239, 68, 68];

  y = ensureSpace(doc, y, 36);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.rect(marginX, y, 80, 25);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...scoreColor);
  doc.text(`${score}%`, marginX + 15, y + 16);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Overall Score', marginX + 35, y + 10);
  doc.text(String(data.hiringRecommendation || ''), marginX + 35, y + 18);

  doc.setFontSize(10);
  doc.text(`Experience: ${data.experienceLevel || 'N/A'}`, 115, y + 10);
  doc.text(`Total: ${data.totalExperience || 'N/A'}`, 115, y + 18);
  y += 35;

  if (data.profileSummary) {
    y = addSectionTitle(doc, 'Profile Summary', marginX, y, contentWidth);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, data.profileSummary, marginX, y, contentWidth) + 3;
  }

  if (data.technicalSkills?.length > 0) {
    y = addSectionTitle(doc, 'Technical Skills', marginX, y, contentWidth);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, toTextList(data.technicalSkills), marginX, y, contentWidth) + 3;
  }

  if (data.workExperience?.length > 0) {
    y = ensureSpace(doc, y, 20);
    y = addSectionTitle(doc, 'Work Experience', marginX, y, contentWidth);

    data.workExperience.forEach((job) => {
      y = ensureSpace(doc, y, 24);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${job.role || job.title || 'Role'} — ${job.company || 'Company'}`, marginX, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      if (job.duration) {
        doc.text(String(job.duration), marginX, y);
        y += 5;
      }
      doc.setFont('helvetica', 'normal');
      (job.highlights || []).slice(0, 3).forEach((highlight) => {
        y = addWrappedText(doc, `• ${highlight}`, marginX + 5, y, contentWidth - 5, 4) + 1;
      });
      y += 3;
    });
  }

  if (data.education?.length > 0) {
    y = ensureSpace(doc, y, 20);
    y = addSectionTitle(doc, 'Education', marginX, y, contentWidth);

    data.education.forEach((education) => {
      y = ensureSpace(doc, y, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(String(education.degree || 'Degree'), marginX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        `${education.institution || 'Institution'} — ${education.year || 'N/A'}${education.gpa ? ` (GPA: ${education.gpa})` : ''}`,
        marginX,
        y
      );
      y += 8;
    });
  }

  if (match && match.matchScore !== undefined) {
    y = ensureSpace(doc, y, 24);
    y = addSectionTitle(doc, 'Job Match Results', marginX, y, contentWidth);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Match Score: ${Math.round(Number(match.matchScore) || 0)}%`, marginX, y);
    y += 6;
    if (match.recommendation) {
      doc.text(`Recommendation: ${match.recommendation}`, marginX, y);
      y += 6;
    }

    if (match.matchedSkills?.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Matched Skills:', marginX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y = addWrappedText(doc, toTextList(match.matchedSkills), marginX, y, contentWidth) + 3;
    }

    if (match.missingSkills?.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Skills to Develop:', marginX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y = addWrappedText(doc, toTextList(match.missingSkills), marginX, y, contentWidth) + 3;
    }

    if (match.summary) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary:', marginX, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      y = addWrappedText(doc, match.summary, marginX, y, contentWidth) + 3;
    }
  }

  if (data.strengths?.length > 0) {
    y = ensureSpace(doc, y, 18);
    y = addSectionTitle(doc, 'Strengths', marginX, y, contentWidth);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    data.strengths.forEach((strength) => {
      y = ensureSpace(doc, y, 6);
      doc.text(`✓ ${strength}`, marginX, y);
      y += 5;
    });
    y += 3;
  }

  if (data.areasToImprove?.length > 0) {
    y = ensureSpace(doc, y, 18);
    y = addSectionTitle(doc, 'Areas to Improve', marginX, y, contentWidth);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    data.areasToImprove.forEach((area) => {
      y = ensureSpace(doc, y, 6);
      doc.text(`→ ${area}`, marginX, y);
      y += 5;
    });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`SmartHire AI - Page ${pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const fileName = `${String(data.candidateName || data.name || 'candidate').replace(/\s+/g, '-').toLowerCase()}-report.pdf`;
  doc.save(fileName);
}