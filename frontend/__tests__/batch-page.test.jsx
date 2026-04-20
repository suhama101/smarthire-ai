import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import BatchResumeUploadPage from '../app/batch/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('BatchResumeUploadPage', () => {
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123' }));
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

    global.fetch = jest.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      const response = body.fileName.includes('ava')
        ? {
            candidateName: 'Ava Chen',
            matchScore: 96,
            matchedSkills: ['React', 'Next.js', 'Tailwind CSS'],
            missingSkills: ['Docker'],
            experienceFit: 'Strong',
            recommendation: 'Strongly Recommended',
            profile: {
              name: 'Ava Chen',
              email: 'ava@example.com',
              summary: 'Frontend leader with product delivery experience.',
              experience: [{ title: 'Frontend Engineer', company: 'Acme', duration: '3 years' }],
              education: [{ degree: 'BSc Computer Science', institution: 'State University', year: '2024' }],
            },
          }
        : {
            candidateName: 'Noah Patel',
            matchScore: 91,
            matchedSkills: ['Node.js', 'Express', 'PostgreSQL'],
            missingSkills: ['Kubernetes'],
            experienceFit: 'Moderate',
            recommendation: 'Recommended',
            profile: {
              name: 'Noah Patel',
              email: 'noah@example.com',
              summary: 'Backend engineer with API and database depth.',
              experience: [{ title: 'Backend Engineer', company: 'Nova', duration: '2 years' }],
              education: [],
            },
          };

      return {
        ok: true,
        json: async () => response,
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
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ fileName: 'ava-chen.pdf', jobTitle: 'Senior Frontend Engineer' });
      expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ fileName: 'noah-patel.docx', jobTitle: 'Senior Frontend Engineer' });
      expect(screen.getByText('Batch analysis complete.')).toBeInTheDocument();
      expect(screen.getAllByText('Ava Chen').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Noah Patel').length).toBeGreaterThan(0);
    });

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
