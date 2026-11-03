import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { Model } from '../database/modelRepository';
import type { Chat } from '../database/chatRepository';

const mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('../hooks/useChatHeader', () => ({
  __esModule: true,
  default: () => ({ MenuElements: null, titleBottom: 0 }),
}));

jest.mock('../hooks/useChatBackGuard', () => ({
  useChatBackGuard: jest.fn(),
}));

jest.mock('../database/chatRepository', () => ({
  ...jest.requireActual('../database/chatRepository'),
  setChatModel: jest.fn(() => Promise.resolve()),
  getAllChats: jest.fn(() => Promise.resolve([])),
}));

type ScreenProps = {
  model: Model | undefined;
  selectModel: (model: Model) => Promise<void>;
};
const mockScreenProps: { current?: ScreenProps } = {};
jest.mock('../components/chat-screen/ChatScreen', () => ({
  __esModule: true,
  default: (props: ScreenProps) => {
    mockScreenProps.current = props;
    return null;
  },
}));

import ChatRoute from '../app/(drawer)/chat/[id]';
import { useChatStore, UNSET_CHAT_MODEL } from '../store/chatStore';
import { useModelStore } from '../store/modelStore';

const model = (id: number, fields: Partial<Model> = {}) =>
  ({ id, modelName: `Model ${id}`, isDownloaded: true, ...fields }) as Model;

const gemma = model(7);
const qwen = model(3);

const savedChat = (modelId: number): Chat => ({
  id: 5,
  modelId,
  title: 'Trip',
  lastUsed: 0,
});

const phantom = (modelId: number): Chat => ({
  id: 5,
  modelId,
  title: '',
  lastUsed: 0,
  enabledSources: [],
});

const shownModel = () => mockScreenProps.current?.model;

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockParams)) delete mockParams[key];
  mockParams.id = '5';
  mockScreenProps.current = undefined;
  useModelStore.setState({ models: [gemma, qwen] });
  useChatStore.setState({ db: {} as never, chats: [], phantomChat: null });
});

describe('the model a chat screen shows', () => {
  it('follows the chat when its model is changed elsewhere', () => {
    useChatStore.setState({ chats: [savedChat(gemma.id)] });
    render(<ChatRoute />);
    expect(shownModel()?.id).toBe(gemma.id);

    act(() => useChatStore.setState({ chats: [savedChat(qwen.id)] }));

    expect(shownModel()?.id).toBe(qwen.id);
  });

  it('drops the model once it is removed', () => {
    useChatStore.setState({ chats: [savedChat(gemma.id)] });
    render(<ChatRoute />);

    act(() => useModelStore.setState({ models: [qwen] }));

    expect(shownModel()).toBeUndefined();
  });

  it('sees that the model files were deleted', () => {
    useChatStore.setState({ chats: [savedChat(gemma.id)] });
    render(<ChatRoute />);

    act(() =>
      useModelStore.setState({
        models: [model(gemma.id, { isDownloaded: false }), qwen],
      })
    );

    expect(shownModel()?.isDownloaded).toBe(false);
  });

  it('switches a new chat to the model picked for it', async () => {
    mockParams.modelId = String(gemma.id);
    useChatStore.setState({ phantomChat: phantom(gemma.id) });
    render(<ChatRoute />);

    await act(() => mockScreenProps.current!.selectModel(qwen));

    expect(shownModel()?.id).toBe(qwen.id);
  });

  it('falls back to the model in the route for a new chat started without one', () => {
    mockParams.modelId = String(qwen.id);
    useChatStore.setState({ phantomChat: phantom(UNSET_CHAT_MODEL) });

    render(<ChatRoute />);

    expect(shownModel()?.id).toBe(qwen.id);
  });
});
