import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import LoginPage from '../src/app/login/page';
import SignupPage from '../src/app/signup/page';

jest.mock('axios');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('Auth pages', () => {
  const pushMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: pushMock });
  });

  test('renders the login page as a standalone route', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /signup/i })).toHaveAttribute('href', '/signup');
  });

  test('renders the signup page as a standalone route', () => {
    render(<SignupPage />);

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
  });
});