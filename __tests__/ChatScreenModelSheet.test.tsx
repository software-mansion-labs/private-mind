import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Model } from '../database/modelRepository';
import { CHAT_ENTRY_ACTION } from '../constants/chat-route-params';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const mockDb = {};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

jest.mock('expo-router', () => ({ useIsFocused: () => true }));

jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 103,
}));

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: () => ({ vectorStore: null, embeddings: null }),
}));

jest.mock('../components/chat-screen/useKeyboardLift', () => ({
  useKeyboardLift: () => ({ value: 0 }),
}));

jest.mock('../hooks/useChatSettings', () => ({
  __esModule: true,
  default: () => ({ settings: {}, setSetting: jest.fn() }),
}));

jest.mock('../hooks/useChatBranching', () => ({
  __esModule: true,
  default: () => ({
    branchMarkers: [],
    handleForkMessage: jest.fn(),
    handleBranchMarkerPress: jest.fn(),
  }),
}));

jest.mock('../hooks/useLegacyChatNotice', () => ({
  useLegacyChatNotice: jest.fn(),
}));

jest.mock('../components/chat-screen/useSendChatMessage', () => ({
  useSendChatMessage: () => jest.fn(),
}));

jest.mock('../components/chat-screen/useChatScreenActions', () => ({
  useChatScreenActions: () => ({
    handleThinkingToggle: jest.fn(),
    thinkingEnabled: false,
    handleWebSearchToggle: jest.fn(),
    handleSelectPrompt: jest.fn(),
    webSearchEnabled: false,
  }),
}));

jest.mock('../components/chat-screen/Messages', () => {
  const { forwardRef } = require('react');
  const { View } = require('react-native');
  const Messages = forwardRef(
    ({ turnFooter }: { turnFooter?: React.ReactNode }, _ref: unknown) => (
      <View>{turnFooter}</View>
    )
  );
  Messages.displayName = 'Messages';
  return { __esModule: true, default: Messages };
});

jest.mock('../components/chat-screen/ChatBar', () => {
  const { forwardRef } = require('react');
  const ChatBar = forwardRef(() => null);
  ChatBar.displayName = 'ChatBar';
  return { __esModule: true, default: ChatBar };
});

const mockPresentModelSheet = jest.fn();
const mockSheet: {
  onModelPicked?: (model: Model) => void;
  onSheetStateChange?: (isOpen: boolean) => void;
} = {};
jest.mock('../components/bottomSheets/ModelSelectSheet', () => ({
  __esModule: true,
  default: ({
    bottomSheetModalRef,
    onModelPicked,
    onSheetStateChange,
  }: {
    bottomSheetModalRef: { current: unknown };
    onModelPicked: (model: Model) => void;
    onSheetStateChange: (isOpen: boolean) => void;
  }) => {
    bottomSheetModalRef.current = { present: mockPresentModelSheet };
    mockSheet.onModelPicked = onModelPicked;
    mockSheet.onSheetStateChange = onSheetStateChange;
    return null;
  },
}));

const mockSetLastUsedModelId = jest.fn();
jest.mock('../utils/lastUsedModel', () => ({
  ...jest.requireActual('../utils/lastUsedModel'),
  setLastUsedModelId: (...args: unknown[]) => mockSetLastUsedModelId(...args),
}));

const mockStartPhantomChat = jest.fn((..._args: unknown[]) =>
  Promise.resolve()
);
jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: (...args: unknown[]) => mockStartPhantomChat(...args),
}));

import ChatScreen from '../components/chat-screen/ChatScreen';
import { useLLMStore } from '../store/llmStore';
import { useChatStore } from '../store/chatStore';

const CHAT_ID = 5;

const gemma = {
  id: 7,
  modelName: 'Gemma 4 - 2B',
  isDownloaded: true,
} as Model;

const renderChat = (props: { opensModelSheet?: boolean } = {}) =>
  render(
    <ChatScreen
      chatId={CHAT_ID}
      chat={{ id: CHAT_ID, modelId: gemma.id, title: 'Trip', lastUsed: 0 }}
      messageHistory={[]}
      model={gemma}
      {...props}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  useChatStore.setState({ phantomChat: null });
  useLLMStore.setState({
    memoryStalls: {},
    isGenerating: false,
    isLoading: false,
  });
});

describe('picking another model after a memory stall', () => {
  it('opens a new chat that asks for a model the moment it appears', async () => {
    useLLMStore.setState({ memoryStalls: { [CHAT_ID]: gemma.id } });
    renderChat();

    await act(async () => {
      fireEvent.press(screen.getByText('New chat with another model'));
    });

    expect(mockStartPhantomChat).toHaveBeenCalledWith(
      mockDb,
      'push',
      undefined,
      CHAT_ENTRY_ACTION.PickModel
    );
  });

  it('presents the model sheet when the chat is entered to pick a model', () => {
    renderChat({ opensModelSheet: true });

    expect(mockPresentModelSheet).toHaveBeenCalledTimes(1);
  });

  it('leaves the sheet closed on an ordinary chat entry', () => {
    renderChat();

    expect(mockPresentModelSheet).not.toHaveBeenCalled();
  });
});

describe('switching to a model the engine declines', () => {
  const qwen = {
    id: 9,
    modelName: 'Qwen 3 - 1.7B',
    isDownloaded: true,
  } as Model;

  it('leaves the explanation to the store instead of raising an error', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const loadModel = jest.fn(() => Promise.resolve());
    useLLMStore.setState({ model: null, loadModel });
    renderChat();

    await act(async () => {
      mockSheet.onModelPicked?.(qwen);
      mockSheet.onSheetStateChange?.(false);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(loadModel).toHaveBeenCalledWith(qwen);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mockSetLastUsedModelId).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
