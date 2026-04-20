import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import LoginPage from '../src/app/login/page';
import SignupPage from '../src/app/signup/page';

jest.mock('axios');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

describe('Auth pages', () => {
  const pushMock = jest.fn();
  const searchParamsMock = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: pushMock });
    require('next/navigation').useSearchParams.mockReturnValue(searchParamsMock);
    searchParamsMock.get.mockReturnValue('');
  });

  test('renders the login page as a standalone route', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in to continue/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /signup/i })).toHaveAttribute('href', '/signup');
  });

  test('shows validation errors on login submit and redirects to the from query param after success', async () => {
    searchParamsMock.get.mockImplementation((key) => (key === 'from' ? '/dashboard' : ''));
    axios.post.mockResolvedValue({ data: { token: 'token', user: { email: 'test@example.com' } } });

    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });

  test('renders the signup page as a standalone route', () => {
    render(<SignupPage />);

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
  });

  test('validates signup fields and redirects to the dashboard after success', async () => {
    axios.post.mockResolvedValue({ data: { token: 'token', user: { email: 'candidate@example.com' } } });

    render(<SignupPage />);

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(screen.getByText('Full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('you@company.com'), { target: { value: 'candidate@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Candidate User' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
  });
});