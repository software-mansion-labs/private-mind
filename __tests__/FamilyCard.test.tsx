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
  const { TouchableOpacity } = require('react-native');
  return { TouchableOpacity };
});

jest.mock('../components/Chip', () => {
  const { Text } = require('react-native');
  return ({ title }: { title: string }) => (
    <Text testID={`chip-${title}`}>{title}</Text>
  );
});

import FamilyCard from '../components/model-hub/FamilyCard';

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
    expect(screen.queryByTestId('chip-Incompatible')).toBeNull();
    expect(opacityOf()).not.toBe(0.5);
  });

  it('says so at the list level when no variant fits, but still opens (#372)', () => {
    const onPress = jest.fn();
    render(<FamilyCard family={family} onPress={onPress} runnable={false} />);
    expect(screen.getByTestId('chip-Incompatible')).toBeTruthy();
    expect(opacityOf()).toBe(0.5);
    fireEvent.press(screen.getByTestId('family-card-Gemma 4'));
    expect(onPress).toHaveBeenCalledWith(family);
  });
});
