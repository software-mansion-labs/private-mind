import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import WhatsNewCard from '../components/WhatsNewCard';
import { LATEST_RELEASE } from '../constants/latest-release';

describe('WhatsNewCard on a short screen', () => {
  it('keeps the badge and the title outside the part that scrolls', () => {
    render(<WhatsNewCard />);
    const highlights = screen.getByTestId('whats-new-highlights');

    expect(within(highlights).queryByText(LATEST_RELEASE.title)).toBeNull();
    expect(within(highlights).queryByText("What's new")).toBeNull();
    expect(screen.getByText(LATEST_RELEASE.title)).toBeTruthy();
    expect(screen.getByText("What's new")).toBeTruthy();
  });

  it('lets every highlight scroll inside the card', () => {
    render(<WhatsNewCard />);
    const highlights = screen.getByTestId('whats-new-highlights');

    for (const item of LATEST_RELEASE.highlights) {
      expect(within(highlights).getByText(item)).toBeTruthy();
    }
  });
});
