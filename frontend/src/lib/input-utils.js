const ALLOWED_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md']);
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

export function sanitizeText(value) {
  return String(value || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizePlainText(value) {
  return sanitizeText(value).replace(/[<>]/g, '');
}

export function getAllowedFileExtensions() {
  return Array.from(ALLOWED_FILE_EXTENSIONS);
}

export function validateResumeFile(file) {
  if (!file || typeof file !== 'object') {
    return { valid: false, message: 'Please upload a resume file.' };
  }

  const fileName = String(file.name || '').trim();
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return { valid: false, message: 'Unsupported file format' };
  }

  if (Number(file.size) > MAX_FILE_SIZE_BYTES) {
    return { valid: false, message: 'File too large. Max 4MB.' };
  }

  return { valid: true, message: '' };
}

export function sanitizeFileName(fileName) {
  return String(fileName || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '');
}

export function getFriendlyApiError(error, fallbackMessage = 'Upload failed — please check your connection') {
  const responseMessage = String(error?.response?.data?.error || error?.message || '').trim();

  if (/anthropic_api_key|api key/i.test(responseMessage)) {
    return 'Server configuration error. Contact admin to set ANTHROPIC_API_KEY in Vercel.';
  }

  if (/too large/i.test(responseMessage)) {
    return 'File too large. Max 4MB.';
  }

  if (/unsupported file/i.test(responseMessage)) {
    return 'Unsupported file format';
  }

  if (/too many requests/i.test(responseMessage)) {
    return 'Too many requests. Please wait a moment.';
  }

  if (/temporarily unavailable/i.test(responseMessage)) {
    return 'AI analysis temporarily unavailable. Please try again in a moment.';
  }

  if (/could not extract readable text from this pdf/i.test(responseMessage)) {
    return 'This PDF appears to be scanned or image-based. Please upload a text-based PDF or DOCX file.';
  }

  if (/network|failed to fetch|timeout|connection/i.test(responseMessage)) {
    return fallbackMessage;
  }

  return fallbackMessage;
}
