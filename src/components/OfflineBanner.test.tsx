import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner (PWA-3)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('appears while offline and goes away when the connection is back', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline.');

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
