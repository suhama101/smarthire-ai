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

    await screen.findByText('Online');

    expect(screen.getByText('Enterprise hiring intelligence for screening, matching, and batch review.')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Review history' })).toHaveAttribute('href', '/history');
    expect(screen.getByText('AI-assisted screening')).toBeInTheDocument();
    expect(screen.getByText('Session-based history')).toBeInTheDocument();
    expect(screen.getByText('A cleaner front door for enterprise stakeholders.')).toBeInTheDocument();
    expect(screen.getByText('Drop resumes here or browse your files')).toBeInTheDocument();
  });

  test('shows a logged-in welcome banner when auth exists', async () => {
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123', user: { name: 'Amina Khan', email: 'amina@example.com' } }));

    render(<HomePage />);

    await screen.findByText('Online');

    expect(screen.getByText('Welcome back, Amina Khan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  test('renders the health badge and upload controls', async () => {
    render(<HomePage />);

    expect(screen.getByRole('button', { name: 'Choose File' })).toBeInTheDocument();

    await screen.findByText('Online');
  });
});
