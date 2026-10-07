import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

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

jest.mock('../components/Chip', () => {
  const { Text } = require('react-native');
  return ({ title }: { title: string }) => (
    <Text testID={`chip-${title}`}>{title}</Text>
  );
});

jest.mock('../components/CircleButton', () => {
  const { TouchableOpacity } = require('react-native');
  return ({
    onPress,
    disabled,
    testID,
  }: {
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
  }) => (
    <TouchableOpacity
      testID={testID || 'circle-btn'}
      onPress={onPress}
      disabled={disabled}
    />
  );
});

import ModelCard from '../components/model-hub/ModelCard';
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
  source: 'remote';
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

type ModelCardProps = React.ComponentProps<typeof ModelCard>;

const renderCard = (
  props: Partial<
    typeof baseModel & {
      compactView?: boolean;
      selected?: boolean;
      onPress?: ModelCardProps['onPress'];
      wifiWarningSheetRef?: ModelCardProps['wifiWarningSheetRef'];
    }
  > = {}
) => {
  const onPress = props.onPress || jest.fn();
  return render(
    <ModelCard
      model={{ ...baseModel, ...props }}
      onPress={onPress}
      compactView={props.compactView}
      selected={props.selected}
      wifiWarningSheetRef={props.wifiWarningSheetRef}
    />
  );
};

beforeEach(() => {
  withDownloadStates({});
  mockIsModelCompatible.mockReturnValue(true);
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, type: 'wifi' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

// ─── display ──────────────────────────────────────────────────────────────────

describe('display', () => {
  it('renders model name', () => {
    renderCard();
    expect(screen.getByText('Llama-3B')).toBeTruthy();
  });

  it('shows size and parameters as one plain meta line', () => {
    renderCard();
    expect(screen.getByText('2.50 GB · 3.21 B')).toBeTruthy();
  });

  it('shows Incompatible chip when model is not compatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard();
    expect(screen.getByTestId('chip-Incompatible')).toBeTruthy();
  });

  it('shows a Vision badge when model supports vision', () => {
    renderCard({ vision: true });
    expect(screen.getByTestId('capability-badge-Vision')).toBeTruthy();
  });

  it('does not show a Vision badge when model does not support vision', () => {
    renderCard({ vision: false });
    expect(screen.queryByTestId('capability-badge-Vision')).toBeNull();
  });

  it('shows a Thinking badge for a thinking model, even in compact view', () => {
    renderCard({ thinking: true, compactView: true });
    expect(screen.getByTestId('capability-badge-Thinking')).toBeTruthy();
  });

  it('renders label badges without repeating a capability', () => {
    renderCard({
      compactView: false,
      thinking: true,
      labels: ['Fast', 'Reasoning'],
    });
    expect(screen.getByTestId('capability-badge-Fast')).toBeTruthy();
    expect(screen.getByTestId('capability-badge-Thinking')).toBeTruthy();
    expect(screen.queryByTestId('capability-badge-Reasoning')).toBeNull();
  });

  it('omits label badges in compact view', () => {
    renderCard({ compactView: true, labels: ['Fast'] });
    expect(screen.queryByTestId('capability-badge-Fast')).toBeNull();
  });

  it('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    render(<ModelCard model={baseModel} onPress={onPress} />);
    fireEvent.press(screen.getByText('Llama-3B'));
    expect(onPress).toHaveBeenCalledWith(baseModel);
  });
});

// ─── download states ──────────────────────────────────────────────────────────

describe('download state rendering', () => {
  it('shows download button when NotStarted', () => {
    withDownloadStates({
      1: { status: ModelState.NotStarted, progress: 0 },
    });
    renderCard();
    expect(screen.getByTestId('circle-btn')).toBeTruthy();
  });

  it('shows progress bar when Downloading', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.4 },
    });
    renderCard();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('shows a check instead of the download button once downloaded', () => {
    withDownloadStates({
      1: { status: ModelState.Downloaded, progress: 1 },
    });
    renderCard({ isDownloaded: true, compactView: false });
    expect(screen.queryByTestId('circle-btn')).toBeNull();
    expect(screen.getByTestId('model-downloaded-check')).toBeTruthy();
  });

  it('leaves the check out of compact pickers, where every model is downloaded', () => {
    renderCard({ isDownloaded: true, compactView: true });
    expect(screen.queryByTestId('model-downloaded-check')).toBeNull();
  });

  it('offers deleting files next to the check only when asked to', () => {
    const { rerender } = render(
      <ModelCard
        model={{ ...baseModel, isDownloaded: true }}
        compactView={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.queryByTestId('model-delete-files')).toBeNull();

    rerender(
      <ModelCard
        model={{ ...baseModel, isDownloaded: true }}
        compactView={false}
        onPress={jest.fn()}
        showDeleteButton
      />
    );
    expect(screen.getByTestId('model-delete-files')).toBeTruthy();
    expect(screen.getByTestId('model-downloaded-check')).toBeTruthy();
  });
});

// ─── download action ──────────────────────────────────────────────────────────

describe('download action', () => {
  it('calls downloadModel when download button pressed on wifi', async () => {
    const downloadModel = jest.fn().mockResolvedValue(undefined);
    withDownloadStates({}, { downloadModel });
    renderCard();
    fireEvent.press(screen.getByTestId('circle-btn'));
    await waitFor(() =>
      expect(downloadModel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      )
    );
  });

  it('shows toast when no internet connection', async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    renderCard();
    fireEvent.press(screen.getByTestId('circle-btn'));
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
    renderCard();
    fireEvent.press(screen.getByTestId('circle-btn'));
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
    } as unknown as ModelCardProps['wifiWarningSheetRef'];
    renderCard({ wifiWarningSheetRef });
    fireEvent.press(screen.getByTestId('circle-btn'));
    await waitFor(() => expect(present).toHaveBeenCalled());
  });
});
