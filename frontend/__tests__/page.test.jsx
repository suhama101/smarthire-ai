import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import HomePage from '../app/page';

jest.mock('axios');

describe('HomePage', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
    axios.get.mockResolvedValue({
      data: { timestamp: '2026-04-06T12:00:00.000Z' },
    });
  });

  afterAll(() => {
    if (typeof originalApiUrl === 'undefined') {
      delete process.env.NEXT_PUBLIC_API_URL;
      return;
    }

    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  test('renders the dashboard shell and health status', async () => {
    render(<HomePage />);

    expect(screen.getByText('Executive Hiring Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Authentication')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/API healthy at/i)).toBeInTheDocument();
    });
  });
});