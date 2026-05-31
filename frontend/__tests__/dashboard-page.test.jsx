import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardPage from '../src/app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('DashboardPage', () => {
  const replaceMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123', user: { id: 'user-123', role: 'recruiter' } }));
    useRouter.mockReturnValue({ replace: replaceMock });
  });

  test('shows the recruiter batch-only message', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText('Use Batch Upload to screen multiple candidates at once.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Batch Upload' })).toHaveAttribute('href', '/batch');
    expect(screen.queryByText('Resume Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('Job Match')).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  test('redirects to login when no session exists', async () => {
    window.localStorage.removeItem('smarthire.auth');

    render(<DashboardPage />);

    expect(await screen.findByText('Redirecting to sign in...')).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });
});
