function getExtension(fileName = '') {
  return String(fileName).split('.').pop().toLowerCase();
}

async function extractPdfText(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (pdfjs?.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString();
  }

  const document = await pdfjs.getDocument({ data: arrayBuffer, useWorkerFetch: false }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => (typeof item.str === 'string' ? item.str : '')).join(' ');
    pages.push(text);
  }

  return pages.join('\n').replace(/\s+/g, ' ').trim();
}

async function extractDocxText(arrayBuffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ arrayBuffer });
  return String(result?.value || '').replace(/\s+/g, ' ').trim();
}

export async function extractResumeTextFromFile(file) {
  if (!file) {
    return '';
  }

  const extension = getExtension(file.name);

  if (extension === 'txt' || extension === 'md') {
    return String(await file.text() || '').replace(/\s+/g, ' ').trim();
  }

  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'docx') {
    return extractDocxText(arrayBuffer);
  }

  if (extension === 'pdf') {
    return extractPdfText(arrayBuffer);
  }

  return String((await file.text()) || '').replace(/\s+/g, ' ').trim();
}
