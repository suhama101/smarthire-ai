import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import HistoryPage from '../app/history/page';

describe('HistoryPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('smarthire.auth', JSON.stringify({ token: 'token-123' }));
  });

  test('renders empty states for analyses and batch runs', () => {
    render(<HistoryPage />);

    expect(screen.getByText('Your analyses and batch runs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Analyses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Batch Runs' })).toBeInTheDocument();
    expect(screen.getByText(/No candidate analyses have been saved in this session yet/i)).toBeInTheDocument();
  });

  test('renders saved analyses and batch runs from local storage', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'smarthire_history',
      JSON.stringify({
        analyses: [
          {
            id: 'analysis-1',
            date: '2026-04-06T12:00:00.000Z',
            resumeFilename: 'ada.pdf',
            jobTitle: 'Frontend Engineer',
            matchScore: 92,
            recommendation: 'Highly Recommended',
            fullResult: { resumeData: { name: 'Ada Lovelace' } },
          },
        ],
        batches: [
          {
            id: 'batch-1',
            date: '2026-04-06T12:00:00.000Z',
            jobTitle: 'Senior Full Stack Engineer',
            companyName: 'Acme Global',
            totalResumes: 8,
            avgScore: 84,
            topCandidate: 'Amina Khan',
            results: [],
          },
        ],
      }),
    );

    render(<HistoryPage />);

    expect(screen.getAllByText('ada.pdf')[0]).toBeInTheDocument();
    expect(screen.getByText('Frontend Engineer')).toBeInTheDocument();
    expect(screen.getAllByText('92%')[0]).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Batch Runs' }));
    expect(screen.getByText('Acme Global')).toBeInTheDocument();
    expect(screen.getAllByText('Amina Khan')[0]).toBeInTheDocument();
  });
});
