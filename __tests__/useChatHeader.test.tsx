import React from 'react';
import { renderHook } from '@testing-library/react-native';

const mockSetOptions = jest.fn();

jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 402, height: 874, scale: 3, fontScale: 1 }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('expo-sqlite', () => ({ useSQLiteContext: jest.fn(() => ({})) }));

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: null })),
}));

jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(() => ({
    getChatById: () => ({ id: 42, title: 'Weekend in London' }),
    renameChat: jest.fn(),
    deleteChat: jest.fn(),
  })),
}));

import useChatHeader from '../hooks/useChatHeader';
import { headerTitleMaxWidth } from '../constants/chat-screen';

const renderChatHeader = () =>
  renderHook(() =>
    useChatHeader({
      chatId: 42,
      chatModel: undefined,
      isEmpty: false,
      onSelectModelFromTitle: jest.fn(),
    })
  );

beforeEach(() => mockSetOptions.mockClear());

describe('useChatHeader', () => {
  it('caps the title container at the width left beside the buttons', () => {
    renderChatHeader();

    expect(mockSetOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        headerTitleContainerStyle: {
          maxWidth: headerTitleMaxWidth(402, { left: 0, right: 0 }),
        },
      })
    );
  });

  it('does not leave the title to the slot React Navigation reserves on iOS', () => {
    renderChatHeader();

    const { headerTitleContainerStyle } = mockSetOptions.mock.calls[0]![0];

    expect(headerTitleContainerStyle.maxWidth).toBeGreaterThan(
      402 - (80 + 16) * 2
    );
  });
});
