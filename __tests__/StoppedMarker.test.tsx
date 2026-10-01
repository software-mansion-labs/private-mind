import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import StoppedMarker from '../components/chat-screen/StoppedMarker';

jest.mock('../assets/icons/rotate_left.svg', () => 'RotateLeftIcon');

describe('StoppedMarker', () => {
  it('names the stop without offering a retry when none is available', () => {
    render(<StoppedMarker />);

    expect(screen.getByText('You stopped this response')).toBeTruthy();
    expect(screen.queryByLabelText('Retry this response')).toBeNull();
  });

  it('offers the retry it was given', () => {
    const onRetry = jest.fn();
    render(<StoppedMarker onRetry={onRetry} />);

    fireEvent.press(screen.getByLabelText('Retry this response'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
