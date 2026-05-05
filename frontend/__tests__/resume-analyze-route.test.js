import pdfParse from 'pdf-parse';
import { Readable } from 'node:stream';
import { generateGeminiContent } from '../src/lib/gemini-model';
import { checkRateLimit } from '../src/lib/rate-limit';
import { POST } from '../app/api/resume/analyze/route';

jest.mock('pdf-parse', () => jest.fn());

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  },
}));

jest.mock('../src/lib/gemini-model', () => ({
  generateGeminiContent: jest.fn(),
}));

jest.mock('../src/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}));

describe('resume analyze route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    checkRateLimit.mockReturnValue({ limited: false });
    generateGeminiContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          name: 'Amina Khan',
          email: 'amina@example.com',
          skills: ['React'],
          experience: [],
          education: [],
          summary: 'Experienced frontend engineer.',
        }),
      },
    });
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
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

  test('extracts full PDF text and sends it to Gemini', async () => {
    pdfParse.mockResolvedValue({ text: 'Senior frontend engineer with React and TypeScript experience.' });

    const response = await POST(createPdfRequest('%PDF-1.4 mocked content'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(pdfParse).toHaveBeenCalledTimes(1);
    expect(generateGeminiContent).toHaveBeenCalledTimes(1);
    expect(String(generateGeminiContent.mock.calls[0][1][0])).toContain('Senior frontend engineer with React and TypeScript experience.');
    expect(payload.resumeText).toBe('Senior frontend engineer with React and TypeScript experience.');
    expect(payload.resumeData.name).toBe('Amina Khan');
  });

  test('returns an error when a PDF has no extractable text', async () => {
    pdfParse.mockResolvedValue({ text: '' });

    const response = await POST(createPdfRequest('%PDF-1.4 empty content'));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toBe('Could not extract text from PDF. Please try a text-based PDF.');
    expect(generateGeminiContent).not.toHaveBeenCalled();
  });
});