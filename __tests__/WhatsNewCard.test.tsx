import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import * as Application from 'expo-application';
import WhatsNewCard from '../components/WhatsNewCard';
import { LATEST_RELEASE } from '../constants/latest-release';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() =>
  useSettingsStore.setState({
    hasHydrated: true,
    dismissedWhatsNewVersion: null,
  })
);

describe('WhatsNewCard on a short screen', () => {
  it('keeps the badge and the title outside the part that scrolls', () => {
    render(<WhatsNewCard />);
    const highlights = screen.getByTestId('whats-new-highlights');

    expect(within(highlights).queryByText(LATEST_RELEASE.title)).toBeNull();
    expect(within(highlights).queryByText("What's new")).toBeNull();
  });

  it('shows the release title and lets every highlight scroll', () => {
    render(<WhatsNewCard />);
    const highlights = screen.getByTestId('whats-new-highlights');

    expect(screen.getByText("What's new")).toBeTruthy();
    expect(screen.getByText(LATEST_RELEASE.title)).toBeTruthy();
    for (const item of LATEST_RELEASE.highlights) {
      expect(within(highlights).getByText(item)).toBeTruthy();
    }
  });
});

describe('closing WhatsNewCard', () => {
  it('hides the card once it is closed', () => {
    render(<WhatsNewCard />);
    fireEvent.press(screen.getByTestId('whats-new-dismiss'));
    expect(screen.queryByTestId('whats-new-card')).toBeNull();
  });

  it('remembers the version it was closed for', () => {
    render(<WhatsNewCard />);
    fireEvent.press(screen.getByTestId('whats-new-dismiss'));
    expect(useSettingsStore.getState().dismissedWhatsNewVersion).toBe(
      Application.nativeApplicationVersion ?? LATEST_RELEASE.version
    );
  });

  it('comes back for a newer release', () => {
    useSettingsStore.setState({ dismissedWhatsNewVersion: '0.0.1' });
    render(<WhatsNewCard />);
    expect(screen.getByTestId('whats-new-card')).toBeTruthy();
  });

  it('waits for saved settings before showing, so a closed card never flashes', () => {
    useSettingsStore.setState({ hasHydrated: false });
    render(<WhatsNewCard />);
    expect(screen.queryByTestId('whats-new-card')).toBeNull();
  });
});
