import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import BatchResumeUploadPage from '../app/batch/page';
import { extractResumeTextFromFile } from '../src/lib/resume-text';

jest.mock('axios');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('../src/lib/resume-text', () => ({
  extractResumeTextFromFile: jest.fn(async (file) => `Resume text for ${file.name}`),
}));

describe('BatchResumeUploadPage', () => {
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123' }));
    useRouter.mockReturnValue({ replace: replaceMock });

    axios.post.mockImplementation((url, body) => {
      if (url !== '/api/batch/analyze') {
        return Promise.reject(new Error(`Unexpected URL ${url}`));
      }

      const candidateIndex = body.candidateIndex;
      const response = candidateIndex === 1
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

      return Promise.resolve({ data: response });
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
      expect(extractResumeTextFromFile).toHaveBeenCalledTimes(2);
      expect(axios.post).toHaveBeenCalledWith('/api/batch/analyze', expect.objectContaining({ candidateIndex: 1 }), expect.any(Object));
      expect(axios.post).toHaveBeenCalledWith('/api/batch/analyze', expect.objectContaining({ candidateIndex: 2 }), expect.any(Object));
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

    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByText('Please enter at least 100 meaningful characters for the job description.')).toBeInTheDocument();
  });
});
