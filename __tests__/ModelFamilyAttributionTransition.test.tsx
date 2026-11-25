import React from 'react';
import { BackHandler } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => ({ family: 'Gemma 4' }),
}));

jest.mock('../store/modelStore', () => ({
  useModelStore: () => ({
    models: [
      {
        id: 1,
        modelName: 'Gemma 4 - E2B',
        family: 'Gemma 4',
        source: 'built-in',
        modelPath:
          'https://huggingface.co/software-mansion/gemma-4-E2B-it-ExecuTorch/resolve/main/m.pte',
        isDownloaded: false,
      },
    ],
  }),
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('../components/bottomSheets/ModelManagementSheet', () => () => null);
jest.mock('../components/bottomSheets/WarningSheet', () => () => null);
jest.mock('../components/model-hub/ModelDownloadRow', () => () => null);
jest.mock('../components/model-hub/ModelFamilyTile', () => () => null);
jest.mock('../components/GlassScreenHeader', () => {
  const { Pressable } = require('react-native');
  const Header = ({ onBack }: { onBack: () => void }) => (
    <Pressable
      onPress={onBack}
      accessibilityRole="button"
      accessibilityLabel="Back"
    />
  );
  return {
    __esModule: true,
    default: Header,
    useGlassScreenHeaderHeight: () => 0,
  };
});

import FamilyScreen from '../app/(modals)/model-family/[family]';

const CARD_NAME =
  'Optimized by Software Mansion AI Labs. Original model by Google';
const ATTRIBUTION_TITLE = 'How this model runs on your phone';

const hiddenFrom = (testID: string) =>
  screen.getByTestId(testID, { includeHiddenElements: true }).props
    .accessibilityElementsHidden;

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockBack.mockClear();
});

describe('model family attribution inside the same sheet', () => {
  it('starts on the model details with the attribution view hidden from screen readers', () => {
    render(<FamilyScreen />);
    expect(screen.getByRole('button', { name: CARD_NAME })).toBeTruthy();
    expect(hiddenFrom('push-transition-first')).toBe(false);
    expect(hiddenFrom('push-transition-second')).toBe(true);
  });

  it('shows the attribution content on tapping the card, with no second sheet', () => {
    render(<FamilyScreen />);
    fireEvent.press(screen.getByRole('button', { name: CARD_NAME }));
    expect(screen.getByText(ATTRIBUTION_TITLE)).toBeTruthy();
    expect(hiddenFrom('push-transition-first')).toBe(true);
    expect(hiddenFrom('push-transition-second')).toBe(false);
  });

  it('returns to the model details with the Back control', () => {
    render(<FamilyScreen />);
    fireEvent.press(screen.getByRole('button', { name: CARD_NAME }));
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(hiddenFrom('push-transition-first')).toBe(false);
    expect(hiddenFrom('push-transition-second')).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('leaves the screen with Back from the model details', () => {
    render(<FamilyScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('returns to the model details on the hardware back press before closing anything', () => {
    const listeners: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      });
    render(<FamilyScreen />);
    fireEvent.press(screen.getByRole('button', { name: CARD_NAME }));
    let consumed: boolean | null | undefined = false;
    act(() => {
      consumed = listeners[listeners.length - 1]({} as never);
    });
    expect(consumed).toBe(true);
    expect(hiddenFrom('push-transition-first')).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('opens on the model details again after the screen is closed and reopened', () => {
    const first = render(<FamilyScreen />);
    fireEvent.press(screen.getByRole('button', { name: CARD_NAME }));
    first.unmount();
    render(<FamilyScreen />);
    expect(hiddenFrom('push-transition-first')).toBe(false);
    expect(hiddenFrom('push-transition-second')).toBe(true);
  });
});
