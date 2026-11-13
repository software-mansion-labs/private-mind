import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WhatsNewBadge, { shouldOpenOnLaunch } from '../components/WhatsNewBadge';
import { LATEST_RELEASE } from '../constants/latest-release';
import { useSettingsStore } from '../store/settingsStore';
import { currentAppVersion } from '../utils/appVersion';
import { markOnboardingComplete } from '../utils/onboardingStatus';

const forcedRelease = { ...LATEST_RELEASE, opensOnLaunch: true };
const shippedVersion = LATEST_RELEASE.version;
const flagThisRelease = () => {
  LATEST_RELEASE.version = currentAppVersion();
  LATEST_RELEASE.opensOnLaunch = true;
};
const seenVersion = () => useSettingsStore.getState().dismissedWhatsNewVersion;

beforeEach(async () => {
  await AsyncStorage.clear();
  LATEST_RELEASE.version = shippedVersion;
  LATEST_RELEASE.opensOnLaunch = false;
  useSettingsStore.setState({
    hasHydrated: true,
    dismissedWhatsNewVersion: null,
  });
});

afterAll(() => {
  LATEST_RELEASE.version = shippedVersion;
  LATEST_RELEASE.opensOnLaunch = false;
});

describe('the What is new badge', () => {
  it('names the release until it has been opened', () => {
    render(<WhatsNewBadge />);

    expect(screen.getByTestId('whats-new-badge')).toBeTruthy();
    expect(seenVersion()).toBeNull();
  });

  it('goes away once opened and remembers the version', () => {
    render(<WhatsNewBadge />);

    fireEvent.press(screen.getByTestId('whats-new-badge'));

    expect(screen.queryByTestId('whats-new-badge')).toBeNull();
    expect(seenVersion()).toBe(currentAppVersion());
  });

  it('comes back for a newer release', () => {
    useSettingsStore.setState({ dismissedWhatsNewVersion: '0.0.1' });
    render(<WhatsNewBadge />);

    expect(screen.getByTestId('whats-new-badge')).toBeTruthy();
  });

  it('waits for saved settings, so a seen badge never flashes', () => {
    useSettingsStore.setState({ hasHydrated: false });
    render(<WhatsNewBadge />);

    expect(screen.queryByTestId('whats-new-badge')).toBeNull();
  });

  it('keeps every release highlight in the sheet', () => {
    render(<WhatsNewBadge />);

    for (const item of LATEST_RELEASE.highlights) {
      expect(screen.getByText(item)).toBeTruthy();
    }
  });
});

describe('opening the sheet on launch', () => {
  it('stays closed unless the release asks for it', () => {
    expect(shouldOpenOnLaunch(LATEST_RELEASE, '1.3.5', null)).toBe(false);
  });

  it('opens for a flagged release that has not been seen', () => {
    const { version } = forcedRelease;

    expect(shouldOpenOnLaunch(forcedRelease, version, null)).toBe(true);
    expect(shouldOpenOnLaunch(forcedRelease, version, '0.0.1')).toBe(true);
  });

  it('opens only once', () => {
    const { version } = forcedRelease;

    expect(shouldOpenOnLaunch(forcedRelease, version, version)).toBe(false);
  });

  it('ignores a flag left over from a different release', () => {
    expect(shouldOpenOnLaunch(forcedRelease, '9.9.9', null)).toBe(false);
  });

  it('counts as seen once onboarding is complete', async () => {
    flagThisRelease();
    await markOnboardingComplete();

    render(<WhatsNewBadge />);

    await waitFor(() => expect(seenVersion()).toBe(currentAppVersion()));
  });

  it('never opens on top of onboarding', async () => {
    flagThisRelease();

    render(<WhatsNewBadge />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(seenVersion()).toBeNull();
  });
});
