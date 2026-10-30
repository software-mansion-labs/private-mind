import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { Model } from '../database/modelRepository';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockDownloadedModels: Model[] = [];
jest.mock('../store/modelStore', () => ({
  useModelStore: (
    selector: (state: { downloadedModels: Model[] }) => unknown
  ) => selector({ downloadedModels: mockDownloadedModels }),
}));

import ComposerModelMenu from '../components/chat-screen/ComposerModelMenu';

const qwen = {
  id: 1,
  modelName: 'Qwen 3 - 1.7B',
  thinking: true,
  modelSize: 2.16,
} as Model;
const gemma = {
  id: 2,
  modelName: 'Gemma 4 VL - 2B',
  vision: true,
  modelSize: 3,
} as Model;

const renderMenu = (props = {}) => {
  const handlers = {
    onPick: jest.fn(),
    onShowAllModels: jest.fn(),
    onClose: jest.fn(),
  };
  render(
    <ComposerModelMenu
      visible
      anchorBottom={120}
      currentModelId={1}
      {...handlers}
      {...props}
    />
  );
  return handlers;
};

beforeEach(() => {
  mockDownloadedModels.splice(0, mockDownloadedModels.length, qwen, gemma);
});

describe('ComposerModelMenu', () => {
  it('renders nothing while closed', () => {
    renderMenu({ visible: false });
    expect(screen.queryByTestId('model-menu')).toBeNull();
  });

  it('lists every downloaded model with its capability and size', () => {
    renderMenu();
    expect(screen.getByText('Qwen 3 - 1.7B')).toBeTruthy();
    expect(screen.getByText('Thinking · 2.16 GB')).toBeTruthy();
    expect(screen.getByText('Gemma 4 VL - 2B')).toBeTruthy();
    expect(screen.getByText('Vision · 3.00 GB')).toBeTruthy();
  });

  it('checks only the model the chat is using', () => {
    renderMenu();
    expect(
      screen.getByTestId('model-menu-row-1').props.accessibilityState.checked
    ).toBe(true);
    expect(
      screen.getByTestId('model-menu-row-2').props.accessibilityState.checked
    ).toBe(false);
    expect(screen.getAllByTestId('model-menu-current')).toHaveLength(1);
  });

  it('hands the tapped model back', () => {
    const { onPick } = renderMenu();
    fireEvent.press(screen.getByTestId('model-menu-row-2'));
    expect(onPick).toHaveBeenCalledWith(gemma);
  });

  it('offers the full model list', () => {
    const { onShowAllModels } = renderMenu();
    fireEvent.press(screen.getByTestId('model-menu-all-models'));
    expect(onShowAllModels).toHaveBeenCalledTimes(1);
  });

  it('closes from a tap outside the menu', () => {
    const { onClose } = renderMenu();
    fireEvent.press(screen.getByTestId('model-menu-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sits the given distance above the bottom of the window', () => {
    renderMenu({ anchorBottom: 140 });
    const menu = screen.getByTestId('model-menu');
    const anchored = menu.parent?.parent;
    expect(anchored?.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ bottom: 140 })])
    );
  });

  it('closes on the Android back button instead of leaving the chat', () => {
    const addListener = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    const { onClose } = renderMenu();

    const handler = addListener.mock.calls.at(-1)?.[1] as () => boolean;

    expect(handler()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    addListener.mockRestore();
  });
});
