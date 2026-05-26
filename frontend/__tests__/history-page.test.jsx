import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import HistoryPage from '../app/history/page';

jest.mock('@/lib/auth-session', () => ({
  readStoredAuth: jest.fn(() => ({
    user: { id: 'user-123', role: 'recruiter' },
    token: 'token-123',
  })),
}));

jest.mock('@/lib/supabaseClient', () => ({
  getSupabaseClient: jest.fn(),
}));

const { getSupabaseClient } = require('@/lib/supabaseClient');

function createSupabaseMock({ analyses = [], batches = [] } = {}) {
  return {
    from(table) {
      const payload = table === 'analyses' ? analyses : batches;

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({ data: payload, error: null });
        },
      };
    },
  };
}

describe('HistoryPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSupabaseClient.mockReset();
  });

  test('renders empty states for analyses and batch runs', async () => {
    getSupabaseClient.mockReturnValue(createSupabaseMock());

    render(<HistoryPage />);

    expect(await screen.findByText('Your analyses and batch runs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Analyses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batch Runs' })).toBeInTheDocument();
    expect(screen.getByText(/No candidate analyses have been saved in Supabase yet/i)).toBeInTheDocument();
  });

  test('renders saved analyses and batch runs from Supabase', async () => {
    const user = userEvent.setup();

    getSupabaseClient.mockReturnValue(
      createSupabaseMock({
        analyses: [
          {
            id: 'analysis-1',
            created_at: '2026-04-06T12:00:00.000Z',
            user_id: 'user-123',
            resume_data: {
              candidateName: 'Ada Lovelace',
              email: 'ada@example.com',
              overallScore: 92,
              hiringRecommendation: 'Strong Hire',
              profileSummary: 'Mathematician and pioneer.',
              technicalSkills: ['JavaScript', 'React'],
              workExperience: [],
              education: [],
              projects: [],
              strengths: ['Analytical'],
              areasToImprove: ['Add cloud experience'],
            },
          },
        ],
        batches: [
          {
            id: 'match-1',
            created_at: '2026-04-06T12:00:00.000Z',
            user_id: 'user-123',
            job_title: 'Senior Full Stack Engineer',
            company_name: 'Acme Global',
            match_result: {
              candidateName: 'Amina Khan',
              matchScore: 84,
              recommendation: 'Strong Match',
              summary: 'Great fit for the role.',
            },
          },
        ],
      })
    );

    render(<HistoryPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('92% Score')).toBeInTheDocument();
    expect(screen.getByText('Strong Hire')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Batch Runs' }));
    expect(screen.getByText('Acme Global')).toBeInTheDocument();
    expect(screen.getByText('Amina Khan')).toBeInTheDocument();
  });
});
