import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));

const mockStart = jest.fn();
jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: (...args: unknown[]) => mockStart(...args),
}));

import NewChatHeaderButton from '../components/NewChatHeaderButton';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe('NewChatHeaderButton', () => {
  it('renders a Touchable', () => {
    const { UNSAFE_getAllByType } = render(<NewChatHeaderButton />);
    const { TouchableOpacity } = require('react-native');
    expect(UNSAFE_getAllByType(TouchableOpacity).length).toBeGreaterThan(0);
  });

  it('starts a phantom chat when noOp is not set', () => {
    const { UNSAFE_getByType } = render(<NewChatHeaderButton />);
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(mockStart).toHaveBeenCalled();
  });

  it('does nothing when noOp=true', () => {
    const { UNSAFE_getByType } = render(<NewChatHeaderButton noOp={true} />);
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(mockStart).not.toHaveBeenCalled();
  });
});
