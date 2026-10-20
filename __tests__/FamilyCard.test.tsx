import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { Pressable } = require('react-native');
  return { Pressable };
});

jest.mock('../components/model-hub/ModelFamilyTile', () => () => null);

const mockDownloadStates: Record<number, { progress: number; status: string }> =
  {};
jest.mock('../store/modelStore', () => ({
  useModelStore: (
    selector: (state: { downloadStates: typeof mockDownloadStates }) => unknown
  ) => selector({ downloadStates: mockDownloadStates }),
  ModelState: { Downloading: 'downloading' },
}));

import FamilyCard from '../components/model-hub/FamilyCard';
import { DIMMED_OPACITY } from '../styles/pressable';

const family = {
  name: 'Gemma 4',
  models: [
    {
      id: 1,
      modelName: 'Gemma 4 - 2B',
      source: 'built-in' as const,
      isDownloaded: false,
      modelPath: '',
      tokenizerPath: '',
      tokenizerConfigPath: '',
    },
  ],
};

const opacityOf = () =>
  StyleSheet.flatten(screen.getByTestId('family-card-Gemma 4').props.style)
    .opacity;

describe('FamilyCard', () => {
  it('reads as available when the device can run at least one variant', () => {
    render(<FamilyCard family={family} onPress={jest.fn()} />);
    expect(screen.queryByText('Incompatible')).toBeNull();
    expect(opacityOf()).not.toBe(DIMMED_OPACITY);
  });

  it('says so at the list level when no variant fits, but still opens (#372)', () => {
    const onPress = jest.fn();
    render(<FamilyCard family={family} onPress={onPress} runnable={false} />);
    expect(screen.getByText('Incompatible')).toBeTruthy();
    expect(opacityOf()).toBe(DIMMED_OPACITY);
    fireEvent.press(screen.getByTestId('family-card-Gemma 4'));
    expect(onPress).toHaveBeenCalledWith(family);
  });

  it('counts variants and marks the family once a variant is downloaded', () => {
    const { rerender } = render(
      <FamilyCard family={family} onPress={jest.fn()} />
    );
    expect(screen.getByText('1 variant')).toBeTruthy();
    expect(screen.queryByTestId('family-card-downloaded')).toBeNull();

    rerender(
      <FamilyCard
        family={{
          ...family,
          models: [
            { ...family.models[0], isDownloaded: true },
            { ...family.models[0], id: 2, modelName: 'Gemma 4 - 4B' },
          ],
        }}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByText('2 variants · 1 downloaded')).toBeTruthy();
    expect(screen.getByTestId('family-card-downloaded')).toBeTruthy();
  });

  it('shows the summary and up to five labels gathered from its variants', () => {
    render(
      <FamilyCard
        family={{
          ...family,
          models: [
            { ...family.models[0], vision: true, labels: ['Fast', 'Small'] },
            {
              ...family.models[0],
              id: 2,
              thinking: true,
              labels: ['Fast', 'Balanced', 'Vision', 'Powerful', 'Smart'],
            },
          ],
        }}
        onPress={jest.fn()}
      />
    );
    expect(screen.getByText('Google · small, chat and vision')).toBeTruthy();
    expect(
      ['Thinking', 'Vision', 'Fast', 'Small', 'Balanced'].map((label) =>
        screen.getByText(label)
      )
    ).toHaveLength(5);
    expect(screen.queryByText('Powerful')).toBeNull();
    expect(screen.getByText('+2')).toBeTruthy();
  });

  describe('download status icons', () => {
    afterEach(() => {
      for (const id of Object.keys(mockDownloadStates)) {
        delete mockDownloadStates[Number(id)];
      }
    });

    const twoVariants = {
      ...family,
      models: [
        { ...family.models[0], isDownloaded: true },
        { ...family.models[0], id: 2, modelName: 'Gemma 4 - 4B' },
      ],
    };

    it('shows a spinner while a variant is downloading', () => {
      mockDownloadStates[1] = { progress: 0.3, status: 'downloading' };
      render(<FamilyCard family={family} onPress={jest.fn()} />);
      expect(screen.getByTestId('family-card-downloading')).toBeTruthy();
      expect(screen.queryByTestId('family-card-downloaded')).toBeNull();
      expect(screen.getByLabelText('Gemma 4, 1 downloading')).toBeTruthy();
    });

    it('shows the spinner and the check side by side when one variant is downloaded and another is downloading', () => {
      mockDownloadStates[2] = { progress: 0.3, status: 'downloading' };
      render(<FamilyCard family={twoVariants} onPress={jest.fn()} />);
      expect(screen.getByTestId('family-card-downloading')).toBeTruthy();
      expect(screen.getByTestId('family-card-downloaded')).toBeTruthy();
      expect(
        screen.getByLabelText('Gemma 4, 1 downloaded, 1 downloading')
      ).toBeTruthy();
    });

    it('shows only the check once nothing is downloading', () => {
      render(<FamilyCard family={twoVariants} onPress={jest.fn()} />);
      expect(screen.queryByTestId('family-card-downloading')).toBeNull();
      expect(screen.getByTestId('family-card-downloaded')).toBeTruthy();
    });
  });
});
