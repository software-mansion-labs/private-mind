import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { Model } from '../database/modelRepository';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const mockDb = {};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
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

jest.mock('../components/bottomSheets/ModelSelectSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/chat-screen/ModelUpdateBanner', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ model }: { model: { modelName: string } }) => (
      <Text>{`update ${model.modelName}`}</Text>
    ),
  };
});

const mockNeedsUpdate = jest.fn();
jest.mock('../utils/modelUpdate', () => ({
  ...jest.requireActual('../utils/modelUpdate'),
  needsUpdate: (model: unknown) => mockNeedsUpdate(model),
}));

jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: jest.fn(() => Promise.resolve()),
}));

import ChatScreen from '../components/chat-screen/ChatScreen';
import type { Message } from '../database/chatRepository';

const CHAT_ID = 5;

const qwen = {
  id: 1,
  modelName: 'Qwen 3 - 0.6B',
  isDownloaded: true,
} as Model;

const earlierTurn = [
  { id: 1, chatId: CHAT_ID, role: 'user', content: 'Say hi', timestamp: 1 },
] as Message[];

const renderChat = (messageHistory: Message[]) =>
  render(
    <ChatScreen
      chatId={CHAT_ID}
      chat={{ id: CHAT_ID, modelId: qwen.id, title: 'Hi', lastUsed: 0 }}
      messageHistory={messageHistory}
      model={qwen}
    />
  );

beforeEach(() => {
  mockNeedsUpdate.mockReset();
});

describe('the model update notice in a chat', () => {
  it('floats at the top of a chat whose model needs the new files', () => {
    mockNeedsUpdate.mockReturnValue(true);
    renderChat(earlierTurn);
    expect(screen.getByText('update Qwen 3 - 0.6B')).toBeTruthy();
  });

  it('stays away from a chat whose model is up to date', () => {
    mockNeedsUpdate.mockReturnValue(false);
    renderChat(earlierTurn);
    expect(screen.queryByText('update Qwen 3 - 0.6B')).toBeNull();
  });

  it('leaves an empty chat to the new chat screen', () => {
    mockNeedsUpdate.mockReturnValue(true);
    renderChat([]);
    expect(screen.queryByText('update Qwen 3 - 0.6B')).toBeNull();
  });
});
