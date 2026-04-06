const fs = require('fs');
const path = require('path');

async function extractPdfText(buffer) {
  const pdfModule = require('pdf-parse');

  if (typeof pdfModule === 'function') {
    const result = await pdfModule(buffer);
    return result?.text || '';
  }

  if (typeof pdfModule?.default === 'function') {
    const result = await pdfModule.default(buffer);
    return result?.text || '';
  }

  if (typeof pdfModule?.PDFParse === 'function') {
    const parser = new pdfModule.PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result?.text || String(result || '');
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  }

  throw new Error('Unsupported pdf-parse export format');
}

function cleanText(text) {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractTextFromFile(filePath, mimeType) {
  const extension = path.extname(filePath).toLowerCase();

  if (mimeType === 'text/plain' || extension === '.txt' || extension === '.md') {
    return fs.readFileSync(filePath, 'utf8');
  }

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    return extractPdfText(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function deleteFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

module.exports = { extractTextFromFile, cleanText, deleteFile };