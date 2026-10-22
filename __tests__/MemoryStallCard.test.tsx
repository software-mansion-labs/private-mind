import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MemoryStallCard from '../components/chat-screen/MemoryStallCard';

const handlers = () => ({
  onStartNewChat: jest.fn(),
  onTryAgain: jest.fn(),
});

describe('MemoryStallCard', () => {
  it('explains the slowdown without blaming the user', () => {
    render(<MemoryStallCard stalledModelName="Gemma 4 - 2B" {...handlers()} />);

    expect(screen.getByText('This is taking longer than usual')).toBeTruthy();
    expect(
      screen.getByText(
        'Your phone is short on memory right now, so Gemma 4 - 2B is running very slowly. A smaller model in a new chat can answer right away.'
      )
    ).toBeTruthy();
  });

  it('sends the user to a new chat to pick another model', () => {
    const actions = handlers();
    render(<MemoryStallCard stalledModelName="Gemma 4 - 2B" {...actions} />);

    fireEvent.press(screen.getByText('New chat with another model'));

    expect(actions.onStartNewChat).toHaveBeenCalledTimes(1);
    expect(actions.onTryAgain).not.toHaveBeenCalled();
  });

  it('retries with the same model', () => {
    const actions = handlers();
    render(<MemoryStallCard stalledModelName="Gemma 4 - 2B" {...actions} />);

    fireEvent.press(screen.getByText('Try again'));

    expect(actions.onTryAgain).toHaveBeenCalledTimes(1);
    expect(actions.onStartNewChat).not.toHaveBeenCalled();
  });

  it('ignores both buttons while a model is loading', () => {
    const actions = handlers();
    render(
      <MemoryStallCard stalledModelName="Gemma 4 - 2B" disabled {...actions} />
    );

    fireEvent.press(screen.getByText('New chat with another model'));
    fireEvent.press(screen.getByText('Try again'));

    expect(actions.onStartNewChat).not.toHaveBeenCalled();
    expect(actions.onTryAgain).not.toHaveBeenCalled();
  });
});
