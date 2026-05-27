import { render, screen } from '@testing-library/react';
import HomePage from '../app/page';

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
  });

  test('renders the marketing landing page', async () => {
    render(<HomePage />);

    expect(screen.getByText('Enterprise hiring intelligence for screening, matching, and batch review.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByText('AI-assisted screening')).toBeInTheDocument();
    expect(screen.getByText('Session-based history')).toBeInTheDocument();
    expect(screen.getByText('Local history storage')).toBeInTheDocument();
    expect(screen.getByText('A cleaner front door for enterprise stakeholders.')).toBeInTheDocument();
    expect(screen.getByText('Designed for hiring teams, not demo decks.')).toBeInTheDocument();
  });

  test('shows a logged-in welcome banner when auth exists', async () => {
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123', user: { name: 'Amina Khan', email: 'amina@example.com' } }));

    render(<HomePage />);

    expect(screen.getByText('Welcome back, Amina Khan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  test('renders the feature cards and trust points', async () => {
    render(<HomePage />);

    expect(screen.getByText('Recruiter-ready metrics')).toBeInTheDocument();
    expect(screen.getByText('Learning plans that explain the gap')).toBeInTheDocument();
    expect(screen.getByText('Candidate screening in one session')).toBeInTheDocument();
  });
});
