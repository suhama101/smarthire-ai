import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import HomePage from '../app/page';

jest.mock('axios');

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { timestamp: '2026-04-06T12:00:00.000Z' },
    });
  });

  test('renders the dashboard shell and health status', async () => {
    render(<HomePage />);

    expect(screen.getByText('Executive Hiring Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Authentication')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/API healthy at/i)).toBeInTheDocument();
    });
  });

  test('logs in with the auth form and stores the JWT', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValue({
      data: { token: 'jwt-token-123' },
    });

    render(<HomePage />);

    await user.type(screen.getByPlaceholderText('Email'), 'candidate@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(window.localStorage.getItem('smarthire_jwt')).toBe('jwt-token-123');
    });

    expect(screen.getByText(/Authenticated\. JWT is stored in localStorage/i)).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5000/api/auth/login',
      {
        email: 'candidate@example.com',
        password: 'password123',
      }
    );
  });
});