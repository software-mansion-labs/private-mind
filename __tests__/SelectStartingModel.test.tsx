import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => ({})),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, type: 'wifi' })),
}));

jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { downloadStart: jest.fn(), cancelDownload: jest.fn() },
}));

jest.mock('../store/chatStore', () => ({
  useChatStore: () => ({ initPhantomChat: jest.fn() }),
}));

jest.mock('../store/llmStore', () => ({
  useLLMStore: () => ({ setActiveChatId: jest.fn() }),
}));

jest.mock('../database/chatRepository', () => ({
  getNextChatId: jest.fn(() => Promise.resolve(1)),
}));

jest.mock('../constants/default-models', () => ({
  getStartingModels: () => ['Gemma', 'Qwen'],
}));

jest.mock('../utils/modelCompatibility', () => ({
  getDeviceMemoryGB: () => 8,
}));

jest.mock('../database/modelRepository', () => ({
  getModelsByNames: jest.fn(() =>
    Promise.resolve([
      { id: 1, modelName: 'Gemma', modelSize: 2.9, isDownloaded: false },
      { id: 2, modelName: 'Qwen', modelSize: 2.16, isDownloaded: false },
    ])
  ),
}));

jest.mock('../store/modelStore', () => {
  const { create } = require('zustand');
  const ModelState = {
    Downloaded: 'downloaded',
    Downloading: 'downloading',
    NotStarted: 'not_started',
  };
  const pending = new Map<number, () => void>();
  const setStatus = (id: number, status: string) =>
    useModelStore.setState((state: { downloadStates: object }) => ({
      downloadStates: {
        ...state.downloadStates,
        [id]: { progress: 0, status },
      },
    }));
  const useModelStore = create(() => ({
    models: [],
    downloadStates: {},
    downloadModel: (model: { id: number }) => {
      setStatus(model.id, ModelState.Downloading);
      return new Promise<void>((resolve) => pending.set(model.id, resolve));
    },
    cancelDownload: async (model: { id: number }) => {
      setStatus(model.id, ModelState.NotStarted);
      pending.get(model.id)?.();
    },
  }));
  return { ModelState, useModelStore };
});

jest.mock('../components/model-hub/ModelCard', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return ({
    model,
    selected,
    locked,
    downloadStatus,
    onPress,
    onCancel,
  }: {
    model: { id: number; modelName: string };
    selected: boolean;
    locked: boolean;
    downloadStatus?: string;
    onPress: (model: unknown) => void;
    onCancel: (model: unknown) => void;
  }) => (
    <>
      <TouchableOpacity
        testID={`card-${model.modelName}`}
        accessibilityState={{ checked: selected, disabled: locked }}
        onPress={() => !locked && onPress(model)}
      >
        <Text>{downloadStatus ?? 'idle'}</Text>
      </TouchableOpacity>
      {downloadStatus === 'downloading' && (
        <TouchableOpacity
          testID={`cancel-${model.modelName}`}
          onPress={() => onCancel(model)}
        />
      )}
    </>
  );
});

import SelectStartingModelScreen from '../app/(modals)/select-starting-model';
import { useModelStore } from '../store/modelStore';

beforeEach(() => useModelStore.setState({ downloadStates: {} }));

const renderScreen = async () => {
  render(<SelectStartingModelScreen />);
  await screen.findByTestId('card-Gemma');
};

const startDownload = async (label: string, count: number) => {
  fireEvent.press(screen.getByText(label));
  await waitFor(() =>
    expect(screen.getAllByText('downloading')).toHaveLength(count)
  );
};

describe('select starting model', () => {
  it('asks for a selection before anything is picked', async () => {
    await renderScreen();
    expect(screen.getByText('Select a model')).toBeTruthy();
  });

  it('sums the size of every selected model in the download label', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    expect(screen.getByText('Download 2 models · 5.06 GB')).toBeTruthy();
  });

  it('downloads every selected model at the same time', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    await startDownload('Download 2 models · 5.06 GB', 2);
    expect(screen.getByText('Downloading… 0%')).toBeTruthy();
  });

  it('goes back to selecting multiple models after cancelling a download', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    await startDownload('Download 1 model · 2.90 GB', 1);

    fireEvent.press(screen.getByTestId('cancel-Gemma'));
    await waitFor(() =>
      expect(screen.getByText('Select a model')).toBeTruthy()
    );

    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    expect(screen.getByText('Download 2 models · 5.06 GB')).toBeTruthy();

    await startDownload('Download 2 models · 5.06 GB', 2);
  });
});
