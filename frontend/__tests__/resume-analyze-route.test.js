import { Readable } from 'node:stream';
import { analyzeWithGroq } from '../src/lib/groqClient';
import { checkRateLimit } from '../src/lib/rate-limit';
import { POST } from '../app/api/resume/analyze/route';

const getRawTextContentMock = jest.fn();
const parserDestroyMock = jest.fn();
const parseBufferMock = jest.fn();
let pdfParserReadyHandler = null;
let pdfParserErrorHandler = null;

jest.mock('pdf2json', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn((eventName, handler) => {
      if (eventName === 'pdfParser_dataReady') {
        pdfParserReadyHandler = handler;
      }

      if (eventName === 'pdfParser_dataError') {
        pdfParserErrorHandler = handler;
      }
    }),
    parseBuffer: parseBufferMock.mockImplementation((buffer) => {
      if (String(buffer || '').includes('empty content')) {
        pdfParserErrorHandler?.({ parserError: 'parse failure' });
        return;
      }

      pdfParserReadyHandler?.();
    }),
    getRawTextContent: getRawTextContentMock,
    destroy: parserDestroyMock,
  }))
);

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}));

jest.mock('../src/lib/groqClient', () => ({
  analyzeWithGroq: jest.fn(),
}));

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}));

describe('resume analyze route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pdfParserReadyHandler = null;
    pdfParserErrorHandler = null;
    process.env.GROQ_API_KEY = 'test-key';
    checkRateLimit.mockReturnValue({ limited: false });
    getRawTextContentMock.mockReturnValue('Senior frontend engineer with React and TypeScript experience.');
    analyzeWithGroq.mockResolvedValue(JSON.stringify({
      name: 'Amina Khan',
      email: 'amina@example.com',
      skills: ['React'],
      experience: [],
      education: [],
      summary: 'Experienced frontend engineer.',
    }));
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
  });

  function createPdfRequest(fileContent) {
    const boundary = '----smarthire-boundary';
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="resume"; filename="resume.pdf"',
      'Content-Type: application/pdf',
      '',
      fileContent,
      `--${boundary}--`,
      '',
    ].join('\r\n');

    return {
      headers: new Headers({
        'content-type': `multipart/form-data; boundary=${boundary}`,
      }),
      body: Readable.toWeb(Readable.from([Buffer.from(multipartBody)])),
    };
  }

  test('extracts full PDF text and sends it to Groq', async () => {
    const response = await POST(createPdfRequest('%PDF-1.4 mocked content'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(parseBufferMock).toHaveBeenCalledTimes(1);
    expect(analyzeWithGroq).toHaveBeenCalledTimes(1);
    expect(String(analyzeWithGroq.mock.calls[0][0])).toContain('Senior frontend engineer with React and TypeScript experience.');
    expect(payload.resumeText).toBe('Senior frontend engineer with React and TypeScript experience.');
    expect(payload.resumeData.name).toBe('Amina Khan');
  });

  test('returns an error when a PDF has no extractable text', async () => {
    getRawTextContentMock.mockReturnValue('');

    const response = await POST(createPdfRequest('%PDF-1.4 empty content'));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Could not extract text from PDF. Please try a text-based PDF.');
    expect(analyzeWithGroq).not.toHaveBeenCalled();
  });
});