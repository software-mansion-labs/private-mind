import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MemoryStallCard, {
  type MemoryStallFallback,
} from '../components/chat-screen/MemoryStallCard';

const handlers = () => ({
  onAnswerWithFallback: jest.fn(),
  onDownloadFallback: jest.fn(),
  onTryAgain: jest.fn(),
});

const qwen = (fields: Partial<MemoryStallFallback> = {}) => ({
  modelName: 'Qwen 3 - 1.7B',
  isDownloaded: true,
  isDownloading: false,
  ...fields,
});

describe('MemoryStallCard', () => {
  it('explains the slowdown without blaming the user', () => {
    render(
      <MemoryStallCard
        stalledModelName="Gemma 4 - 2B"
        fallback={qwen()}
        {...handlers()}
      />
    );

    expect(screen.getByText('This is taking longer than usual')).toBeTruthy();
    expect(
      screen.getByText(
        'Your phone is short on memory right now, so Gemma 4 - 2B is running very slowly. A smaller model can answer right away.'
      )
    ).toBeTruthy();
  });

  it('answers with the smaller model when it is downloaded', () => {
    const actions = handlers();
    render(
      <MemoryStallCard
        stalledModelName="Gemma 4 - 2B"
        fallback={qwen()}
        {...actions}
      />
    );

    fireEvent.press(screen.getByText('Answer with Qwen 3 - 1.7B'));

    expect(actions.onAnswerWithFallback).toHaveBeenCalledTimes(1);
    expect(actions.onDownloadFallback).not.toHaveBeenCalled();
  });

  it('offers to download the smaller model when it is not on the phone', () => {
    const actions = handlers();
    render(
      <MemoryStallCard
        stalledModelName="Gemma 4 - 2B"
        fallback={qwen({ isDownloaded: false })}
        {...actions}
      />
    );

    fireEvent.press(screen.getByText('Download Qwen 3 - 1.7B'));

    expect(actions.onDownloadFallback).toHaveBeenCalledTimes(1);
    expect(actions.onAnswerWithFallback).not.toHaveBeenCalled();
  });

  it('does not start a second download while one is running', () => {
    const actions = handlers();
    render(
      <MemoryStallCard
        stalledModelName="Gemma 4 - 2B"
        fallback={qwen({ isDownloaded: false, isDownloading: true })}
        {...actions}
      />
    );

    fireEvent.press(screen.getByText('Downloading Qwen 3 - 1.7B…'));

    expect(actions.onDownloadFallback).not.toHaveBeenCalled();
  });

  it('retries with the same model', () => {
    const actions = handlers();
    render(
      <MemoryStallCard
        stalledModelName="Gemma 4 - 2B"
        fallback={qwen()}
        {...actions}
      />
    );

    fireEvent.press(screen.getByText('Try again'));

    expect(actions.onTryAgain).toHaveBeenCalledTimes(1);
  });

  it('keeps only the retry when there is no smaller model to offer', () => {
    render(<MemoryStallCard stalledModelName="Gemma 4 - 2B" {...handlers()} />);

    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.queryByText(/Answer with|Download/)).toBeNull();
  });
});
