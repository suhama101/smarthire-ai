import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import HomePage from '../app/page';

jest.mock('axios');

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({
      data: { timestamp: '2026-04-06T12:00:00.000Z' },
    });
  });

  test('renders the dashboard shell and health status', async () => {
    render(<HomePage />);

    expect(screen.getByText('AI-Powered Hiring Intelligence')).toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Signup' })).toHaveAttribute('href', '/signup');

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/health');
      expect(screen.getByText(/API healthy at/i)).toBeInTheDocument();
    });
  });
});