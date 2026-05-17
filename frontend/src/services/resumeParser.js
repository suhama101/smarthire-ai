import fs from 'node:fs';
import path from 'node:path';
import PDFParser from 'pdf2json';
import * as mammothModule from 'mammoth';
const mammoth = mammothModule.default || mammothModule;

async function extractPdfText(buffer) {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser(null, 1);

      pdfParser.on('pdfParser_dataError', () => {
        resolve('');
      });

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          let fullText = '';

          if (pdfData?.Pages?.length) {
            pdfData.Pages.forEach((page) => {
              let pageText = '';

              page.Texts.forEach((textItem) => {
                textItem.R.forEach((run) => {
                  try {
                    pageText += decodeURIComponent(run.T) + ' ';
                  } catch {
                    pageText += run.T + ' ';
                  }
                });
              });

              fullText += pageText + '\n';
            });
          } else {
            const rawText = typeof pdfParser.getRawTextContent === 'function' ? pdfParser.getRawTextContent() : '';
            fullText = String(rawText || '').replace(/%20/g, ' ');
          }

          resolve(fullText.replace(/\s+/g, ' ').trim());
        } catch {
          resolve('');
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch {
      resolve('');
    }
  });
}

function cleanText(text) {
  return text
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(filePath, mimeType) {
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
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function deleteFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  fs.unlinkSync(filePath);
}

export { cleanText };