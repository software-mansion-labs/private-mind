import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
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

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
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

import ModelDownloadRow from '../components/model-hub/ModelDownloadRow';
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
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;

const baseModel: {
  id: number;
  modelName: string;
  source: 'remote' | 'built-in' | 'local';
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

type RowProps = React.ComponentProps<typeof ModelDownloadRow>;

const renderRow = (
  props: Partial<
    typeof baseModel & {
      showFamilyTile?: boolean;
      onPress?: RowProps['onPress'];
      wifiWarningSheetRef?: RowProps['wifiWarningSheetRef'];
    }
  > = {}
) =>
  render(
    <ModelDownloadRow
      model={{ ...baseModel, ...props }}
      onPress={props.onPress || jest.fn()}
      showFamilyTile={props.showFamilyTile}
      wifiWarningSheetRef={props.wifiWarningSheetRef}
    />
  );

beforeEach(() => {
  withDownloadStates({});
  mockIsModelCompatible.mockReturnValue(true);
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, type: 'wifi' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('display', () => {
  it('renders model name', () => {
    renderRow();
    expect(screen.getByText('Llama-3B')).toBeTruthy();
  });

  it('shows model size and parameters on one meta line', () => {
    renderRow();
    expect(screen.getByText('2.50 GB · 3.21 B')).toBeTruthy();
  });

  it('shows no family tile by default', () => {
    renderRow();
    expect(screen.queryByTestId('model-family-tile')).toBeNull();
  });

  it('shows Incompatible badge when model is not compatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderRow();
    expect(screen.getByTestId('model-badge-Incompatible')).toBeTruthy();
  });

  it('shows Vision badge when model supports vision', () => {
    renderRow({ vision: true });
    expect(screen.getByTestId('model-badge-Vision')).toBeTruthy();
  });

  it('does not show Vision badge when model does not support vision', () => {
    renderRow({ vision: false });
    expect(screen.queryByTestId('model-badge-Vision')).toBeNull();
  });

  it('renders label badges from model.labels', () => {
    renderRow({ labels: ['Fast', 'Reasoning'] });
    expect(screen.getByTestId('model-badge-Fast')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Reasoning')).toBeTruthy();
  });

  it('keeps the Reasoning label next to the Thinking badge', () => {
    renderRow({ thinking: true, labels: ['Reasoning'] });
    expect(screen.getByTestId('model-badge-Thinking')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Reasoning')).toBeTruthy();
  });

  it('does not repeat a capability that the catalog also lists as a label', () => {
    renderRow({ vision: true, labels: ['Vision'] });
    expect(screen.getAllByTestId('model-badge-Vision')).toHaveLength(1);
  });

  it('shows a label the app does not know yet', () => {
    renderRow({ labels: ['Multilingual'] });
    expect(screen.getByTestId('model-badge-Multilingual')).toBeTruthy();
  });

  it('shows the family icon in the tile when asked to', () => {
    renderRow({ modelName: 'Qwen 3 - 1.7B', showFamilyTile: true });
    expect(
      screen.getByTestId('model-family-icon', { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it('shows the first letter of a family without an icon', () => {
    renderRow({ modelName: 'Bielik - v3.0', showFamilyTile: true });
    expect(
      screen.queryByTestId('model-family-icon', { includeHiddenElements: true })
    ).toBeNull();
    expect(screen.getByText('B', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps the family tile out of the screen reader, the name already says it', () => {
    renderRow({ modelName: 'Bielik - v3.0', showFamilyTile: true });
    expect(screen.queryByText('B')).toBeNull();
  });

  it('calls onPress when the row is tapped', () => {
    const onPress = jest.fn();
    renderRow({ onPress });
    fireEvent.press(screen.getByText('Llama-3B'));
    expect(onPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, modelName: 'Llama-3B' })
    );
  });

  it('marks a downloaded model next to its name', () => {
    renderRow({ isDownloaded: true });
    expect(screen.getByTestId('model-download-row-downloaded')).toBeTruthy();
  });
});

describe('download state rendering', () => {
  it('shows the download button when not started', () => {
    renderRow();
    expect(screen.getByTestId('model-download-row-download')).toBeTruthy();
  });

  it('keeps the parameters and labels while downloading', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4 },
    });
    renderRow({ labels: ['Fast'] });
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText('2.50 GB · 3.21 B')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Fast')).toBeTruthy();
    expect(screen.queryByTestId('model-download-row-download')).toBeNull();
  });

  it('shows downloaded GB and time left while downloading', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4, rate: 0.01 },
    });
    renderRow();
    expect(screen.getByText('1.00 of 2.50 GB')).toBeTruthy();
    expect(screen.getByTestId('downloading-model-time-left')).toHaveTextContent(
      '~1 min left'
    );
  });

  it('shows no time left before the rate is known', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4 },
    });
    renderRow();
    expect(screen.getByText('1.00 of 2.50 GB')).toBeTruthy();
    expect(screen.queryByTestId('downloading-model-time-left')).toBeNull();
  });

  it('keeps the family tile choice while downloading', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4 },
    });
    renderRow();
    expect(screen.queryByTestId('model-family-tile')).toBeNull();
  });

  it('offers delete instead of download once downloaded', () => {
    withDownloadStates({
      1: { status: ModelState.Downloaded, progress: 1 },
    });
    renderRow({ isDownloaded: true });
    expect(screen.queryByTestId('model-download-row-download')).toBeNull();
    expect(screen.getByTestId('model-download-row-delete')).toBeTruthy();
  });

  it('offers no delete for a model imported from the device', () => {
    renderRow({ isDownloaded: true, source: 'local' });
    expect(screen.queryByTestId('model-download-row-delete')).toBeNull();
  });
});

describe('download action', () => {
  it('calls downloadModel when download button pressed on wifi', async () => {
    const downloadModel = jest.fn().mockResolvedValue(undefined);
    withDownloadStates({}, { downloadModel });
    renderRow();
    fireEvent.press(screen.getByTestId('model-download-row-download'));
    await waitFor(() =>
      expect(downloadModel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      )
    );
  });

  it('shows toast when no internet connection', async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    renderRow();
    fireEvent.press(screen.getByTestId('model-download-row-download'));
    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ text1: expect.stringContaining('internet') })
      )
    );
  });

  it('calls cancelDownload when cancel button pressed while downloading', async () => {
    const cancelDownload = jest.fn().mockResolvedValue(undefined);
    withDownloadStates(
      { 1: { status: ModelState.Downloading, progress: 0.5 } },
      { cancelDownload }
    );
    renderRow();
    fireEvent.press(screen.getByTestId('model-download-row-cancel'));
    await waitFor(() =>
      expect(cancelDownload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      )
    );
  });

  it('shows wifi warning sheet when on mobile data', async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: true, type: 'cellular' });
    const present = jest.fn();
    const wifiWarningSheetRef = {
      current: { present },
    } as unknown as RowProps['wifiWarningSheetRef'];
    renderRow({ wifiWarningSheetRef });
    fireEvent.press(screen.getByTestId('model-download-row-download'));
    await waitFor(() => expect(present).toHaveBeenCalled());
  });

  it('deletes a downloaded model after confirmation', async () => {
    const removeModelFiles = jest.fn();
    withDownloadStates({}, { removeModelFiles });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons?: AlertButton[]) =>
        buttons?.find((b) => b.style === 'destructive')?.onPress?.()
      );
    renderRow({ isDownloaded: true });
    fireEvent.press(screen.getByTestId('model-download-row-delete'));
    await waitFor(() => expect(removeModelFiles).toHaveBeenCalledWith(1));
  });
});
