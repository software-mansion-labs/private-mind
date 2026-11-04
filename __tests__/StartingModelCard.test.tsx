import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { Alert, AlertButton } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/modelStore', () => ({
  useModelStore: jest.fn((selector) =>
    selector({
      downloadStates: {},
      downloadModel: jest.fn(),
      cancelDownload: jest.fn(),
      removeModelFiles: jest.fn(),
    })
  ),
  ModelState: {
    NotStarted: 'NotStarted',
    Downloading: 'Downloading',
    Downloaded: 'Downloaded',
  },
}));

jest.mock('../utils/modelCompatibility', () => ({
  isModelCompatible: jest.fn(() => true),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: {
    downloadStart: jest.fn(),
    downloadComplete: jest.fn(),
    cancelDownload: jest.fn(),
  },
}));

jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  Pressable: require('react-native').Pressable,
}));

jest.mock('../components/CircleButton', () => {
  const { Pressable } = require('react-native');
  return ({
    onPress,
    disabled,
    testID,
  }: {
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
  }) => (
    <Pressable
      testID={testID || 'circle-btn'}
      onPress={onPress}
      disabled={disabled}
    />
  );
});

import StartingModelCard from '../components/onboarding/StartingModelCard';
import {
  useModelStore,
  ModelState,
  type DownloadState,
} from '../store/modelStore';
import { isModelCompatible } from '../utils/modelCompatibility';

const mockUseModelStore = useModelStore as unknown as jest.Mock;

type ModelStoreMockState = {
  downloadStates: Record<string, DownloadState>;
  downloadModel: jest.Mock;
  cancelDownload: jest.Mock;
  removeModelFiles: jest.Mock;
};

const withDownloadStates = (
  downloadStates: ModelStoreMockState['downloadStates'],
  actions: Partial<ModelStoreMockState> = {}
) =>
  mockUseModelStore.mockImplementation(
    (selector?: (state: ModelStoreMockState) => unknown) => {
      const state: ModelStoreMockState = {
        downloadStates,
        downloadModel: jest.fn(),
        cancelDownload: jest.fn(),
        removeModelFiles: jest.fn(),
        ...actions,
      };
      return selector ? selector(state) : state;
    }
  );
const mockIsModelCompatible = isModelCompatible as jest.Mock;

const baseModel: {
  id: number;
  modelName: string;
  source: 'remote' | 'built-in';
  isDownloaded: boolean;
  featured: boolean;
  parameters: number;
  modelSize: number;
  modelPath: string;
  tokenizerPath: string;
  tokenizerConfigPath: string;
  thinking: boolean;
  vision?: boolean;
  labels: string[];
} = {
  id: 1,
  modelName: 'Llama-3B',
  source: 'remote',
  isDownloaded: false,
  featured: false,
  parameters: 3.21,
  modelSize: 2.5,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  labels: [],
};

type CardProps = React.ComponentProps<typeof StartingModelCard>;

const renderCard = (
  props: Partial<
    typeof baseModel & {
      selected?: boolean;
      locked?: boolean;
      downloadStatus?: CardProps['downloadStatus'];
      onPress?: CardProps['onPress'];
      onCancel?: CardProps['onCancel'];
      onDeleted?: CardProps['onDeleted'];
    }
  > = {}
) =>
  render(
    <StartingModelCard
      model={{ ...baseModel, ...props }}
      selected={props.selected ?? false}
      locked={props.locked ?? false}
      downloadStatus={props.downloadStatus}
      onPress={props.onPress || jest.fn()}
      onCancel={props.onCancel || jest.fn()}
      onDeleted={props.onDeleted || jest.fn()}
    />
  );

beforeEach(() => {
  withDownloadStates({});
  mockIsModelCompatible.mockReturnValue(true);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('display', () => {
  it('shows name, meta and the family tile', () => {
    renderCard({ labels: ['Fast'] });
    expect(screen.getByText('Llama-3B')).toBeTruthy();
    expect(screen.getByText('2.50 GB · 3.21 B')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Fast')).toBeTruthy();
    expect(
      screen.getByTestId('model-family-tile', { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it('shows a checkbox and no download button', () => {
    renderCard();
    expect(screen.getByTestId('starting-model-checkbox')).toBeTruthy();
    expect(screen.queryByTestId('circle-btn')).toBeNull();
  });
});

describe('selection', () => {
  it('reports the checked state to accessibility', () => {
    renderCard({ selected: true });
    expect(screen.getByRole('checkbox', { checked: true })).toBeTruthy();
  });

  it('can be toggled before the model is downloaded', () => {
    const onPress = jest.fn();
    renderCard({ source: 'built-in', onPress });
    fireEvent.press(screen.getByText('Llama-3B'));
    expect(onPress).toHaveBeenCalled();
  });

  it('is disabled when the model is incompatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard();
    expect(screen.getByRole('checkbox', { disabled: true })).toBeTruthy();
  });

  it('is disabled while downloads run', () => {
    renderCard({ locked: true });
    expect(screen.getByRole('checkbox', { disabled: true })).toBeTruthy();
  });
});

describe('selection download', () => {
  it('shows no progress row before downloading starts', () => {
    renderCard({ selected: true });
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByTestId('starting-model-cancel')).toBeNull();
  });

  it('shows the percentage of the model being downloaded', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.7 },
    });
    renderCard({ selected: true, downloadStatus: 'downloading' });
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('keeps the progress to the percentage alone', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4, rate: 0.01 },
    });
    renderCard({ selected: true, downloadStatus: 'downloading' });
    expect(screen.queryByText('1.00 of 2.50 GB')).toBeNull();
    expect(screen.queryByTestId('downloading-model-time-left')).toBeNull();
  });

  it('labels a finished model as Done', () => {
    renderCard({ selected: true, downloadStatus: 'done' });
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('cancels a downloading model', () => {
    const onCancel = jest.fn();
    renderCard({ selected: true, downloadStatus: 'downloading', onCancel });
    fireEvent.press(screen.getByTestId('starting-model-cancel'));
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('offers no cancel once the model is done', () => {
    renderCard({ selected: true, downloadStatus: 'done' });
    expect(screen.queryByTestId('starting-model-cancel')).toBeNull();
  });

  it('deletes a finished model after confirmation', async () => {
    const removeModelFiles = jest.fn();
    withDownloadStates({}, { removeModelFiles });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons?: AlertButton[]) =>
        buttons?.find((b) => b.style === 'destructive')?.onPress?.()
      );
    const onDeleted = jest.fn();
    renderCard({ selected: true, downloadStatus: 'done', onDeleted });
    fireEvent.press(screen.getByTestId('starting-model-delete'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(removeModelFiles).toHaveBeenCalledWith(1);
  });
});
