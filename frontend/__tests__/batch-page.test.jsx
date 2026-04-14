import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import BatchResumeUploadPage from '../app/batch/page';

jest.mock('axios');

describe('BatchResumeUploadPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({
      data: {
        message: 'Batch analysis complete',
        rankedCandidates: [
          {
            rank: 1,
            name: 'Ava Chen',
            score: 96,
            matchedSkills: ['React', 'Next.js', 'Tailwind CSS'],
          },
          {
            rank: 2,
            name: 'Noah Patel',
            score: 91,
            matchedSkills: ['Node.js', 'Express', 'PostgreSQL'],
          },
        ],
      },
    });
  });

  test('uploads multiple resumes and renders ranked candidates', async () => {
    render(<BatchResumeUploadPage />);

    const fileInput = document.querySelector('input[type="file"]');
    const textarea = screen.getByLabelText('Job description');

    fireEvent.change(fileInput, {
      target: {
        files: [
          new File(['resume one'], 'ava-chen.pdf', { type: 'application/pdf', lastModified: 1 }),
          new File(['resume two'], 'noah-patel.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', lastModified: 2 }),
        ],
      },
    });

    fireEvent.change(textarea, {
      target: { value: 'We need a senior frontend engineer with React and Next.js experience.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Analyze batch' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(axios.post).toHaveBeenCalledWith('/api/batch/analyze', expect.any(FormData), expect.any(Object));
      expect(screen.getByText('Ava Chen')).toBeInTheDocument();
      expect(screen.getByText('Noah Patel')).toBeInTheDocument();
    });

    expect(screen.getByText('96')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText(/React, Next.js, Tailwind CSS/)).toBeInTheDocument();
  });
});
