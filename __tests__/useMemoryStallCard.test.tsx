import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useMemoryStallCard } from '../components/chat-screen/useMemoryStallCard';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import type { Message } from '../database/chatRepository';
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
  family: 'Gemma 4',
  modelPath: 'https://example.com/gemma/mlx/model.pte',
  modelSize: 2.9,
});
const qwen = model({
  id: 3,
  modelName: 'Qwen 3 - 1.7B',
  family: 'Qwen 3',
  modelSize: 2.16,
  isDownloaded: false,
});

const question: Message = {
  id: 42,
  chatId: 1,
  role: 'user',
  content: 'Tell me about Rome',
  timestamp: 0,
};

const answerWithModel = jest.fn();
const retryWithChatModel = jest.fn();

const Host = ({ chatModel = gemma }: { chatModel?: Model }) => {
  const card = useMemoryStallCard({
    chatId: 1,
    model: chatModel,
    messageHistory: [question],
    busy: false,
    answerWithModel,
    retryWithChatModel,
  });
  return <>{card}</>;
};

const downloadModel = jest.fn(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  useLLMStore.setState({
    memoryStalls: { 1: gemma.id },
    failedToStartIn: {},
    isGenerating: false,
  });
  useModelStore.setState({
    models: [gemma, qwen],
    downloadStates: {},
    downloadModel,
  });
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

  it('downloads the smaller model when it is not on the phone yet', () => {
    render(<Host />);
    fireEvent.press(screen.getByText('Download Qwen 3 - 1.7B'));
    expect(downloadModel).toHaveBeenCalledWith(qwen);
  });

  it('answers with the smaller model once it is downloaded', () => {
    useModelStore.setState({
      models: [gemma, { ...qwen, isDownloaded: true }],
    });
    render(<Host />);
    fireEvent.press(screen.getByText('Answer with Qwen 3 - 1.7B'));
    expect(answerWithModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: qwen.id })
    );
  });

  it('retries the question on the model that stalled', () => {
    render(<Host />);
    fireEvent.press(screen.getByText('Try again'));
    expect(retryWithChatModel).toHaveBeenCalledTimes(1);
    expect(answerWithModel).not.toHaveBeenCalled();
  });

  it('says the model never started when the app closed while loading it', () => {
    useLLMStore.setState({ failedToStartIn: { 1: gemma.id } });
    render(<Host />);
    expect(screen.getByText("Gemma 4 - 2B couldn't start")).toBeTruthy();
    expect(screen.queryByText('This is taking longer than usual')).toBeNull();
  });

  it('keeps the slow-turn wording for a stall in a running turn', () => {
    render(<Host />);
    expect(screen.getByText('This is taking longer than usual')).toBeTruthy();
  });
});
