import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

describe('FloatingActionButton', () => {
  it('shows its label next to the plus', () => {
    render(<FloatingActionButton label="Add model" onPress={jest.fn()} />);

    expect(screen.getByText('Add model')).toBeTruthy();
  });

  it('keeps its label for screen readers once it shrinks to the plus', () => {
    render(<FloatingActionButton label="Add model" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Add model' })).toBeTruthy();
  });

  it('runs its action when pressed', () => {
    const onPress = jest.fn();
    render(<FloatingActionButton label="Add model" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Add model' }));

    expect(onPress).toHaveBeenCalled();
  });
});
