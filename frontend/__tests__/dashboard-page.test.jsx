import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import DashboardPage from '../src/app/dashboard/page';

jest.mock('axios');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('DashboardPage', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123' }));
    useRouter.mockReturnValue({ replace: replaceMock });
    axios.get.mockResolvedValue({
      data: {
        total_resumes_analyzed: 120,
        average_match_score: 78.4,
        total_job_matches: 54,
        total_skill_gaps_identified: 18,
        trend: [
          { label: 'Jan', score: 62 },
          { label: 'Feb', score: 71 },
        ],
        distribution: [
          { label: 'React', count: 14 },
          { label: 'Node.js', count: 10 },
        ],
        top_skills_matched: [
          { name: 'React', value: 22 },
          { name: 'Next.js', value: 17 },
        ],
      },
    });
  });

  afterEach(() => {
    window.localStorage.removeItem('smarthire.auth');
  });

  afterAll(() => {
    if (typeof originalApiUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_API_URL;
      return;
    }

    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  test('fetches dashboard stats and renders summary cards', async () => {
    render(<DashboardPage />);

    expect(screen.getByText(/Loading dashboard stats/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('https://api.example.com/api/history/dashboard-stats');
    });

    expect(screen.getByText('Total resumes analyzed')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('Average match score')).toBeInTheDocument();
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText('Total job matches')).toBeInTheDocument();
    expect(screen.getByText('54')).toBeInTheDocument();
    expect(screen.getByText('Total skill gaps identified')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText(/Match score trend over time/i)).toBeInTheDocument();
    expect(screen.getByText(/Skill gaps distribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Top skills matched/i)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
