import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockReplace = jest.fn();

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useFocusEffect: jest.fn(),
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
const mockModelState = { downloadedModels: [] as unknown[] };
jest.mock('../store/modelStore', () => ({
  useModelStore: () => mockModelState,
}));
jest.mock('../hooks/useOnboardingRedirect', () => ({
  __esModule: true,
  default: () => 'stayed',
}));
jest.mock('../hooks/useDefaultHeader', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../hooks/useImportChat', () => ({
  useImportChat: () => jest.fn(),
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: () => ({ loadSources: jest.fn() }),
}));
jest.mock('../utils/startPhantomChat', () => ({ startPhantomChat: jest.fn() }));
jest.mock('../components/NewChatHeaderButton', () => () => null);
jest.mock('../components/chat-screen/NewChatBackground', () => ({
  NewChatBackground: () => null,
}));
jest.mock('../components/bottomSheets/ModelSelectSheet', () => {
  const { Text } = require('react-native');
  return () => <Text>model-select-sheet</Text>;
});

import WelcomeScreen from '../app/(drawer)/index';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => {
  mockReplace.mockClear();
  useSettingsStore.setState({
    hasHydrated: true,
    dismissedWhatsNewVersion: null,
  });
});

describe('the welcome screen without a model', () => {
  it('opens the models screen from Choose a model', () => {
    render(<WelcomeScreen />);
    fireEvent(screen.getByTestId('no-model-welcome'), 'layout', {
      nativeEvent: { layout: { height: 844 } },
    });

    fireEvent.press(screen.getByText('Choose a model'));

    expect(mockReplace).toHaveBeenCalledWith('/model-hub');
  });

  it('does not render the model picker sheet', () => {
    render(<WelcomeScreen />);

    expect(screen.queryByText('model-select-sheet')).toBeNull();
  });
});
