import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import BatchResumeUploadPage from '../app/batch/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.setTimeout(15000);

describe('BatchResumeUploadPage', () => {
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123', user: { id: 'user-123', role: 'recruiter' } }));
    useRouter.mockReturnValue({ replace: replaceMock });

    global.FileReader = class MockFileReader {
      constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = '';
      }

      readAsDataURL(file) {
        this.result = `data:${file.type};base64,${btoa(file.name)}`;
        if (this.onload) {
          this.onload();
        }
      }
    };

    global.fetch = jest.fn().mockImplementation(async (url, options = {}) => {
      if (options.body instanceof FormData) {
        const files = Array.from(options.body.getAll('files'));
        const response = {
          success: true,
          message: 'Batch analysis completed successfully!',
          results: files.map((file) => {
            if (String(file?.name || '').includes('ava')) {
              return {
                fileName: file.name,
                success: true,
                data: {
                  candidateName: 'Ava Chen',
                  matchScore: 96,
                  matchedSkills: ['React', 'Next.js', 'Tailwind CSS'],
                  missingSkills: ['GraphQL'],
                  technicalSkills: ['React', 'Next.js', 'Tailwind CSS'],
                  recommendation: 'Strong Match',
                  summary: 'Strong frontend match.',
                  overallScore: 96,
                  hiringRecommendation: 'Hire',
                },
              };
            }

            return {
              fileName: file.name,
              success: true,
              data: {
                candidateName: 'Noah Patel',
                matchScore: 91,
                matchedSkills: ['Node.js', 'Express', 'PostgreSQL'],
                missingSkills: ['Redis'],
                technicalSkills: ['Node.js', 'Express', 'PostgreSQL'],
                recommendation: 'Strong Match',
                summary: 'Strong backend match.',
                overallScore: 91,
                hiringRecommendation: 'Hire',
              },
            };
          }),
        };

        return {
          ok: true,
          text: async () => JSON.stringify(response),
          json: async () => response,
        };
      }

      return {
        ok: true,
        json: async () => ({
          message: 'Batch run saved successfully.',
          batchRun: {
            id: 'batch-run-1',
          },
        }),
        text: async () => JSON.stringify({ message: 'Batch run saved successfully.' }),
      };
    });
  });

  test('runs the sequential batch pipeline and renders the ranked results', async () => {
    const user = userEvent.setup();
    render(<BatchResumeUploadPage />);

    await user.type(screen.getByLabelText('Job Title'), 'Senior Frontend Engineer');
    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Global');
    await user.type(
      screen.getByLabelText('Full Job Description'),
      'We need a senior frontend engineer with React, Next.js, CSS architecture, testing, accessibility, and cloud deployment experience. The role owns product delivery, collaboration, and a high quality bar for enterprise customers.'
    );

    await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, [
      new File(['resume one'], 'ava-chen.pdf', { type: 'application/pdf', lastModified: 1 }),
      new File(['resume two'], 'noah-patel.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', lastModified: 2 }),
    ]);

    await user.click(screen.getByRole('button', { name: 'Start Batch Analysis' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch.mock.calls[0][1].body.getAll('files').map((file) => file.name)).toEqual(['ava-chen.pdf', 'noah-patel.docx']);
      expect(fetch.mock.calls[0][1].body.get('jobTitle')).toBe('Senior Frontend Engineer');
      expect(fetch.mock.calls[1][0]).toBe('/api/batch/save');
      expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer token-123');
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
        userId: 'user-123',
        user_id: 'user-123',
        jobDescription: expect.any(String),
        job_description: expect.any(String),
        totalCandidates: 2,
        total_candidates: 2,
      });
      expect(screen.getByText('Batch analysis complete.')).toBeInTheDocument();
      expect(screen.getAllByText('Ava Chen').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Noah Patel').length).toBeGreaterThan(0);
    }, { timeout: 12000 });

    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export to PDF Report' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /view full profile/i }).length).toBeGreaterThan(0);
  });

  test('blocks step one when the job description is too short', async () => {
    const user = userEvent.setup();
    render(<BatchResumeUploadPage />);

    await user.type(screen.getByLabelText('Job Title'), 'Senior Frontend Engineer');
    await user.type(screen.getByLabelText(/Company Name/i), 'Acme Global');
    await user.type(screen.getByLabelText('Full Job Description'), 'Too short');
    await user.click(screen.getByRole('button', { name: 'Save & Continue' }));

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter at least 100 meaningful characters for the job description.')).toBeInTheDocument();
  });
});
