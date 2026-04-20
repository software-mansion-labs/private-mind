import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

  it('calls router.push("/") when noOp is not set', () => {
    render(<NewChatHeaderButton />);
    const { TouchableOpacity } = require('react-native');
    const { UNSAFE_getByType } = render(<NewChatHeaderButton />);
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('does not call router.push when noOp=true', () => {
    const { UNSAFE_getByType } = render(<NewChatHeaderButton noOp={true} />);
    const { TouchableOpacity } = require('react-native');
    fireEvent.press(UNSAFE_getByType(TouchableOpacity));
    expect(mockPush).not.toHaveBeenCalled();
  });
});
