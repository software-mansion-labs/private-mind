import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import OnboardingCarousel from '../components/onboarding/OnboardingCarousel';
import { ONBOARDING_SLIDES } from '../constants/onboarding';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const renderCarousel = (
  overrides: Partial<React.ComponentProps<typeof OnboardingCarousel>> = {}
) => {
  const props = {
    onSkip: jest.fn(),
    onComplete: jest.fn(),
    onExitToIntro: jest.fn(),
    ...overrides,
  };
  render(<OnboardingCarousel {...props} />);
  return props;
};

describe('OnboardingCarousel', () => {
  it('covers web search between the offline and document slides', () => {
    expect(ONBOARDING_SLIDES.map((slide) => slide.id)).toEqual([
      'offline',
      'web-search',
      'documents',
      'voice',
    ]);
  });

  it('states that only the query leaves the device on the web search slide', () => {
    renderCarousel();
    expect(
      screen.getByText(/Only the search query leaves your device/)
    ).toBeTruthy();
  });

  it('renders one pagination dot per slide', () => {
    renderCarousel();
    ONBOARDING_SLIDES.forEach((_, index) => {
      expect(
        screen.getByLabelText(
          `Go to slide ${index + 1} of ${ONBOARDING_SLIDES.length}`
        )
      ).toBeTruthy();
    });
  });

  it('offers a labelled skip that leaves onboarding without completing it', () => {
    const { onSkip, onComplete } = renderCarousel();

    fireEvent.press(screen.getByLabelText('Skip onboarding'));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('shows the first slide button label before any navigation', () => {
    renderCarousel();
    expect(screen.getByText(ONBOARDING_SLIDES[0].buttonLabel)).toBeTruthy();
  });
});
