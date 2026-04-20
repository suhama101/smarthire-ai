import { render, screen } from '@testing-library/react';
import HomePage from '../app/page';

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('renders the marketing landing page', () => {
    render(<HomePage />);

    expect(screen.getByText('Enterprise hiring intelligence for screening, matching, and batch review.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Review history' })).toHaveAttribute('href', '/history');
    expect(screen.getByText('AI-assisted screening')).toBeInTheDocument();
    expect(screen.getByText('Session-based history')).toBeInTheDocument();
    expect(screen.getByText('A cleaner front door for enterprise stakeholders.')).toBeInTheDocument();
  });

  test('shows a logged-in welcome banner when auth exists', () => {
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123', user: { name: 'Amina Khan', email: 'amina@example.com' } }));

    render(<HomePage />);

    expect(screen.getByText('Welcome back, Amina Khan.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });
});
