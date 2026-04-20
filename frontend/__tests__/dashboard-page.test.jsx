import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardPage from '../src/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('DashboardPage', () => {
  const replaceMock = jest.fn();
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123' }));
    window.localStorage.setItem(
      'smarthire.batch.runs',
      JSON.stringify([
        {
          id: 'batch-2',
          batchName: 'Acme Global • Senior Full Stack Engineer',
          jobTitle: 'Senior Full Stack Engineer',
          companyName: 'Acme Global',
          createdAt: today,
          totalResumes: 4,
          averageScore: 84,
          topCandidate: 'Amina Khan',
          results: [
            { rank: 1, candidateName: 'Amina Khan', matchScore: 96, missingSkills: ['Docker'] },
            { rank: 2, candidateName: 'Daniel Kim', matchScore: 92, missingSkills: ['Docker'] },
            { rank: 3, candidateName: 'Sara Lopez', matchScore: 84, missingSkills: ['Kubernetes'] },
            { rank: 4, candidateName: 'Omar Ali', matchScore: 80, missingSkills: ['Docker'] },
          ],
        },
        {
          id: 'batch-1',
          batchName: 'Nova Labs • Backend Engineer',
          jobTitle: 'Backend Engineer',
          companyName: 'Nova Labs',
          createdAt: yesterday,
          totalResumes: 4,
          averageScore: 76,
          topCandidate: 'Maya Roy',
          results: [
            { rank: 1, candidateName: 'Maya Roy', matchScore: 88, missingSkills: ['Docker'] },
            { rank: 2, candidateName: 'Noah Patel', matchScore: 84, missingSkills: ['Docker'] },
            { rank: 3, candidateName: 'Emily Stone', matchScore: 80, missingSkills: ['Kubernetes'] },
            { rank: 4, candidateName: 'Hassan Noor', matchScore: 68, missingSkills: ['Docker'] },
          ],
        },
      ])
    );
    useRouter.mockReturnValue({ replace: replaceMock });
  });

  test('renders recruiter dashboard metrics and recent batch runs', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Total Resumes Processed')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Average Match Score')).toBeInTheDocument();
    expect(screen.getByText('84%')).toBeInTheDocument();
    expect(screen.getByText('Top Skill Gap Across All Candidates')).toBeInTheDocument();
    expect(screen.getByText('Resumes Processed Today')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.getByText('Acme Global • Senior Full Stack Engineer')).toBeInTheDocument();
    expect(screen.getByText('Nova Labs • Backend Engineer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New Batch Upload' })).toHaveAttribute('href', '/batch');
    expect(screen.getByRole('link', { name: 'View Full History' })).toHaveAttribute('href', '/history');
    expect(screen.getByRole('button', { name: 'Download Last Report' })).toBeEnabled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test('shows the empty state when no batch runs exist', () => {
    window.localStorage.setItem('smarthire.batch.runs', JSON.stringify([]));

    render(<DashboardPage />);

    expect(screen.getByText('No batches run yet. Go to Batch Upload to get started.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start your first batch' })).toHaveAttribute('href', '/batch');
  });
});
