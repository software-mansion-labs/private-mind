import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SettingsRowGroup from '../components/settings/SettingsRowGroup';
import SettingsScreen from '../app/(drawer)/settings';
import { useSettingsStore } from '../store/settingsStore';

const mockPush = jest.fn();
const mockImportChat = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock(
  'expo-router/react-navigation',
  () => ({ useHeaderHeight: () => 0 }),
  { virtual: true }
);
jest.mock('../hooks/useDefaultHeader', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../hooks/useImportChat', () => ({
  useImportChat: () => mockImportChat,
}));
jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: () => ({ vectorStore: null }),
}));
jest.mock('../components/chat-screen/GlassScrollEdge', () => ({
  GlassScrollEdge: () => null,
}));
jest.mock('../utils/Feedback', () => ({
  Feedback: {
    toggleOn: jest.fn(),
    toggleOff: jest.fn(),
    destructive: jest.fn(),
  },
}));
jest.mock('react-native-gesture-handler', () => {
  const { Pressable, ScrollView } = require('react-native');
  return { Pressable, ScrollView };
});

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({
    conversationMemory: 'auto',
    themePreference: 'system',
    showPerformanceMetrics: false,
  });
});

describe('the settings screen', () => {
  it('groups every setting under Chat, Appearance, Data controls and About', () => {
    render(<SettingsScreen />);
    for (const title of ['Chat', 'Appearance', 'Data controls', 'About']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    for (const label of [
      'Custom instructions',
      'Context size',
      'Response speed stats',
      'Theme',
      'Import chat',
      'Delete all chats',
      'App info',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('shows the current context size on the row and opens its page from it', () => {
    useSettingsStore.setState({ conversationMemory: 'low' });
    render(<SettingsScreen />);
    expect(screen.getByTestId('settings-context-size-value')).toHaveTextContent(
      'Low'
    );
    fireEvent.press(screen.getByTestId('settings-context-size'));
    expect(mockPush).toHaveBeenCalledWith('/context-size');
  });

  it('shows the dictation language on its row and opens its page from it', () => {
    useSettingsStore.setState({ dictationLanguage: 'ur' });
    render(<SettingsScreen />);
    expect(
      screen.getByTestId('settings-dictation-language-value')
    ).toHaveTextContent('Urdu');
    fireEvent.press(screen.getByTestId('settings-dictation-language'));
    expect(mockPush).toHaveBeenCalledWith('/dictation-language');
  });

  it('keeps the response speed stats switch working', () => {
    render(<SettingsScreen />);
    fireEvent(screen.getAllByRole('switch')[0]!, 'valueChange', true);
    expect(useSettingsStore.getState().showPerformanceMetrics).toBe(true);
  });

  it('keeps the theme choice working', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-choice-dark'));
    expect(useSettingsStore.getState().themePreference).toBe('dark');
  });

  it('opens custom instructions and app info', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Custom instructions'));
    expect(mockPush).toHaveBeenCalledWith('/custom-system-prompt');
    fireEvent.press(screen.getByText('App info'));
    expect(mockPush).toHaveBeenCalledWith('/app-info');
  });

  it('imports a chat from its row', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Import chat'));
    expect(mockImportChat).toHaveBeenCalledTimes(1);
  });

  it('puts the destructive action last in its group', () => {
    render(<SettingsScreen />);
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.props.accessibilityLabel);
    expect(labels.indexOf('Delete all chats')).toBeGreaterThan(
      labels.indexOf('Import chat')
    );
  });

  it('shows no note about when a context size change applies', () => {
    render(<SettingsScreen />);
    expect(screen.queryByText(/next message/i)).toBeNull();
  });

  it('draws every setting group as one grouped surface', () => {
    const view = render(<SettingsScreen />);
    const groups = view.UNSAFE_getAllByType(SettingsRowGroup);
    expect(groups).toHaveLength(4);
  });
});
