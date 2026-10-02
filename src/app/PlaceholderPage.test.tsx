import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlaceholderPage } from '@/app/PlaceholderPage';

describe('PlaceholderPage', () => {
  it('shows the app name as the main heading', () => {
    render(<PlaceholderPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Streakwise' })).toBeInTheDocument();
  });
});
