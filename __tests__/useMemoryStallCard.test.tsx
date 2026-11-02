import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useMemoryStallCard } from '../components/chat-screen/useMemoryStallCard';
import { useLLMStore } from '../store/llmStore';
import type { Model } from '../database/modelRepository';

const model = (fields: Partial<Model>): Model => ({
  id: 1,
  modelName: 'Model',
  source: 'remote',
  isDownloaded: true,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
  ...fields,
});

const gemma = model({
  id: 7,
  modelName: 'Gemma 4 - 2B',
  modelPath: 'https://example.com/gemma/mlx/model.pte',
});
const qwen = model({ id: 3, modelName: 'Qwen 3 - 1.7B' });

const startNewChat = jest.fn();
const retryWithChatModel = jest.fn();

const Host = ({ chatModel = gemma }: { chatModel?: Model }) => {
  const card = useMemoryStallCard({
    chatId: 1,
    model: chatModel,
    busy: false,
    startNewChat,
    retryWithChatModel,
  });
  return <>{card}</>;
};

beforeEach(() => {
  jest.clearAllMocks();
  useLLMStore.setState({ memoryStalls: { 1: gemma.id }, isGenerating: false });
});

describe('the card a memory stall leaves in the chat', () => {
  it('shows only while the chat is still on the model that stalled', () => {
    const { rerender } = render(<Host />);
    expect(screen.getByTestId('memory-stall-card')).toBeTruthy();

    rerender(<Host chatModel={qwen} />);
    expect(screen.queryByTestId('memory-stall-card')).toBeNull();
  });

  it('stays out of the way while a turn is generating', () => {
    useLLMStore.setState({ isGenerating: true });
    render(<Host />);
    expect(screen.queryByTestId('memory-stall-card')).toBeNull();
  });

  it('opens a new chat to pick another model', () => {
    render(<Host />);
    fireEvent.press(screen.getByText('New chat with another model'));
    expect(startNewChat).toHaveBeenCalledTimes(1);
  });

  it('retries the question on the model that stalled', () => {
    render(<Host />);
    fireEvent.press(screen.getByText('Try again'));
    expect(retryWithChatModel).toHaveBeenCalledTimes(1);
    expect(startNewChat).not.toHaveBeenCalled();
  });
});
