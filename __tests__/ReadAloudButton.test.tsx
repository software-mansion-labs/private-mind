import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ReadAloudButton from '../components/chat-screen/ReadAloudButton';
import { useReadAloudStore } from '../store/readAloudStore';
import type { ReadAloudPlan } from '../utils/readAloudPlan';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/readAloudStore', () => {
  const { create } = jest.requireActual('zustand');
  return {
    useReadAloudStore: create(() => ({
      messageId: null,
      phase: 'idle',
      downloadProgress: 0,
      toggle: jest.fn(),
    })),
  };
});

const PLAN: ReadAloudPlan = {
  text: 'Hello there.',
  language: 'en',
  voice: 'en_female_narrator',
};

const setStore = (state: Record<string, unknown>) =>
  useReadAloudStore.setState(state as never);

beforeEach(() => {
  setStore({ messageId: null, phase: 'idle', downloadProgress: 0 });
});

describe('ReadAloudButton', () => {
  it('offers to read the answer when idle and starts it on press', () => {
    render(<ReadAloudButton messageId={5} plan={PLAN} />);
    fireEvent.press(screen.getByLabelText('Read aloud'));
    expect(useReadAloudStore.getState().toggle).toHaveBeenCalledWith(5, PLAN);
  });

  it('shows the download percentage and offers to cancel it', () => {
    setStore({ messageId: 5, phase: 'downloading', downloadProgress: 0.42 });
    render(<ReadAloudButton messageId={5} plan={PLAN} />);
    expect(screen.getByText('42%')).toBeTruthy();
    expect(screen.getByLabelText('Cancel download')).toBeTruthy();
  });

  it('offers to stop while preparing and while speaking', () => {
    setStore({ messageId: 5, phase: 'preparing' });
    const view = render(<ReadAloudButton messageId={5} plan={PLAN} />);
    expect(screen.getByLabelText('Stop reading')).toBeTruthy();
    setStore({ phase: 'speaking' });
    view.rerender(<ReadAloudButton messageId={5} plan={PLAN} />);
    expect(screen.getByLabelText('Stop reading')).toBeTruthy();
  });

  it('stays idle on a message that is not the one being read', () => {
    setStore({ messageId: 9, phase: 'speaking' });
    render(<ReadAloudButton messageId={5} plan={PLAN} />);
    expect(screen.getByLabelText('Read aloud')).toBeTruthy();
  });
});
