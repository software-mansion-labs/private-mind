import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  Pressable: require('react-native').Pressable,
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
  isModelCompatible: (model: { modelName: string }) =>
    !model.modelName.startsWith('Too big'),
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

jest.mock('../components/model-hub/ModelDownloadRow', () => {
  const { Text, Pressable } = require('react-native');
  const { useModelStore } = require('../store/modelStore');
  return ({
    model,
    selection,
    onPress,
    onCancelled,
  }: {
    model: { id: number; modelName: string };
    selection: { selected: boolean; locked: boolean };
    onPress: (model: unknown) => void;
    onCancelled: (model: unknown) => void;
  }) => {
    const status = useModelStore(
      (state: { downloadStates: Record<number, { status: string }> }) =>
        state.downloadStates[model.id]?.status
    );
    const cancelDownload = useModelStore(
      (state: { cancelDownload: (model: unknown) => Promise<void> }) =>
        state.cancelDownload
    );
    return (
      <>
        <Pressable
          testID={`card-${model.modelName}`}
          accessibilityState={{
            checked: selection.selected,
            disabled: selection.locked,
          }}
          onPress={() => !selection.locked && onPress(model)}
        >
          <Text>{status ?? 'idle'}</Text>
        </Pressable>
        {status === 'downloading' && (
          <Pressable
            testID={`cancel-${model.modelName}`}
            onPress={async () => {
              await cancelDownload(model);
              onCancelled(model);
            }}
          />
        )}
      </>
    );
  };
});

jest.mock('../hooks/useStartingFeatures', () => {
  const { create } = require('zustand');
  const useFeatureStatuses = create(() => ({
    documents: 'available',
    dictation: 'available',
  }));
  const setFeatureStatus = (key: string, status: string) =>
    useFeatureStatuses.setState({ [key]: status });
  const download = jest.fn((key: string) => {
    setFeatureStatus(key, 'downloading');
    return new Promise<boolean>(() => {});
  });
  const cancel = jest.fn(async (key: string) =>
    setFeatureStatus(key, 'available')
  );
  return {
    STARTING_FEATURE_KEYS: ['documents', 'dictation'],
    useFeatureStatuses,
    download,
    useStartingFeatures: () => {
      const statuses = useFeatureStatuses();
      return {
        features: [
          {
            key: 'documents',
            name: 'Documents & web search',
            description: 'Chat with files, search the web',
            sizeGb: 0.58,
            status: statuses.documents,
            progress: 0,
          },
          {
            key: 'dictation',
            name: 'Voice dictation',
            description: 'Speak instead of typing',
            sizeGb: 0.08,
            status: statuses.dictation,
            progress: 0,
          },
        ],
        download,
        cancel,
      };
    },
  };
});

import SelectStartingModelScreen from '../app/(modals)/select-starting-model';
import { ModelState, useModelStore } from '../store/modelStore';

const startingFeatures = jest.requireMock('../hooks/useStartingFeatures');

const defaultRows = () => [
  { id: 1, modelName: 'Gemma', modelSize: 2.9, isDownloaded: false },
  { id: 2, modelName: 'Qwen', modelSize: 2.16, isDownloaded: false },
];

beforeEach(() => {
  useModelStore.setState({ downloadStates: {} });
  startingFeatures.useFeatureStatuses.setState({
    documents: 'available',
    dictation: 'available',
  });
  startingFeatures.download.mockClear();
  jest
    .requireMock('../database/modelRepository')
    .getModelsByNames.mockResolvedValue(defaultRows());
});

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

  it('sums the size of every selected model and feature in the download label', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    expect(screen.getByText('Download 2 models · 5.72 GB')).toBeTruthy();
  });

  it('downloads every selected model at the same time', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    await startDownload('Download 2 models · 5.72 GB', 2);
    expect(screen.getByText('Starting download…')).toBeTruthy();
  });

  it('goes back to selecting multiple models after cancelling a download', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    await startDownload('Download 1 model · 3.56 GB', 1);

    fireEvent.press(screen.getByTestId('cancel-Gemma'));
    await waitFor(() =>
      expect(screen.getByText('Select a model')).toBeTruthy()
    );

    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('card-Qwen'));
    expect(screen.getByText('Download 2 models · 5.06 GB')).toBeTruthy();

    await startDownload('Download 2 models · 5.06 GB', 2);
  });

  it('leaves an unticked feature out of the download size', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('starting-feature-documents'));
    expect(screen.getByText('Download 1 model · 2.98 GB')).toBeTruthy();
  });

  it('downloads the ticked features at the same time as the model', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    fireEvent.press(screen.getByTestId('starting-feature-dictation'));
    await startDownload('Download 1 model · 3.48 GB', 1);

    expect(startingFeatures.download).toHaveBeenCalledWith('documents');
    expect(startingFeatures.download).not.toHaveBeenCalledWith('dictation');
  });

  it('lets the user start chatting while features keep downloading', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    await startDownload('Download 1 model · 3.56 GB', 1);

    act(() =>
      useModelStore.setState({
        downloadStates: { 1: { progress: 1, status: ModelState.Downloaded } },
      })
    );

    expect(await screen.findByText('Start chatting')).toBeTruthy();
    expect(screen.getByText('You can still get these later.')).toBeTruthy();
  });

  it('shows a downloading feature with the same progress details as a model', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    await startDownload('Download 1 model · 3.56 GB', 1);

    expect(
      screen.getByLabelText('Documents & web search download progress')
    ).toBeTruthy();
    expect(screen.getByText('0.00 of 0.58 GB')).toBeTruthy();
    expect(
      screen.getByTestId('starting-feature-documents-cancel')
    ).toBeTruthy();
  });

  it('drops a feature from the selection when its download is cancelled', async () => {
    await renderScreen();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    await startDownload('Download 1 model · 3.56 GB', 1);

    fireEvent.press(screen.getByTestId('starting-feature-dictation-cancel'));

    await waitFor(() =>
      expect(
        screen.getByTestId('starting-feature-dictation').props
          .accessibilityState
      ).toMatchObject({ checked: false })
    );
  });

  it('hides the features once both are already on the phone', async () => {
    startingFeatures.useFeatureStatuses.setState({
      documents: 'downloaded',
      dictation: 'downloaded',
    });
    await renderScreen();

    expect(screen.queryByText('More features')).toBeNull();
    fireEvent.press(screen.getByTestId('card-Gemma'));
    expect(screen.getByText('Download 1 model · 2.90 GB')).toBeTruthy();
  });

  it('never lists a model the card would mark incompatible', async () => {
    const { getModelsByNames } = jest.requireMock(
      '../database/modelRepository'
    );
    getModelsByNames.mockResolvedValue([
      { id: 1, modelName: 'Gemma', modelSize: 2.9, isDownloaded: false },
      { id: 3, modelName: 'Too big', modelSize: 9, isDownloaded: false },
      { id: 2, modelName: 'Qwen', modelSize: 2.16, isDownloaded: false },
    ]);

    await renderScreen();

    expect(screen.queryByTestId('card-Too big')).toBeNull();
    expect(screen.getByTestId('card-Qwen')).toBeTruthy();
  });

  it('says so when no suggested model fits the device', async () => {
    const { getModelsByNames } = jest.requireMock(
      '../database/modelRepository'
    );
    getModelsByNames.mockResolvedValue([
      { id: 3, modelName: 'Too big', modelSize: 9, isDownloaded: false },
    ]);

    render(<SelectStartingModelScreen />);

    expect(
      await screen.findByText("No suggested model fits this device's memory.")
    ).toBeTruthy();
  });
});
