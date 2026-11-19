import React from 'react';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { render, renderHook, screen } from '@testing-library/react-native';

const mockSetOptions = jest.fn();

jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/chat/42',
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
import OnDevicePill from '../components/chat-screen/OnDevicePill';
import { headerTitleMaxWidth } from '../constants/chat-screen';

const renderChatHeader = () =>
  renderHook(() =>
    useChatHeader({
      chatId: 42,
      isEmpty: false,
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

describe('the title in a chat not saved yet', () => {
  const headerTitleOf = (hideTitle: boolean) => {
    renderHook(() =>
      useChatHeader({
        chatId: 42,
        isEmpty: true,
        hideTitle,
      })
    );
    const { headerTitle } = mockSetOptions.mock.calls.at(-1)![0];
    return headerTitle();
  };

  it('shows the on-device pill in place of a title', () => {
    expect(headerTitleOf(true)).toEqual(<OnDevicePill reveal={undefined} />);
  });

  it('keeps the title in a saved chat', () => {
    expect(headerTitleOf(false)).not.toBeNull();
  });
});

describe('the on-device pill in the header', () => {
  const pillOpacity = (reveal: number) => {
    render(
      <OnDevicePill
        reveal={{ get: () => reveal } as unknown as SharedValue<number>}
      />
    );
    return (
      StyleSheet.flatten(
        screen.getByTestId('on-device-pill-reveal').props.style
      ) as { opacity: number }
    ).opacity;
  };

  it('waits for the new chat animation before it shows', () => {
    expect(pillOpacity(0)).toBe(0);
  });

  it('shows once the animation reveals it', () => {
    expect(pillOpacity(1)).toBe(1);
  });
});
