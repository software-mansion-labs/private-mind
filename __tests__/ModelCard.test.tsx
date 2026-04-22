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
  useModelStore: jest.fn(() => ({
    downloadStates: {},
    downloadModel: jest.fn(),
    cancelDownload: jest.fn(),
  })),
  ModelState: {
    NotStarted: 'NotStarted',
    Downloading: 'Downloading',
    Downloaded: 'Downloaded',
  },
}));

jest.mock('../utils/modelCompatibility', () => ({
  isModelCompatible: jest.fn(() => true),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('../components/Chip', () => {
  const { Text } = require('react-native');
  return ({ title }: any) => <Text testID={`chip-${title}`}>{title}</Text>;
});

jest.mock('../components/CircleButton', () => {
  const { TouchableOpacity } = require('react-native');
  return ({ onPress, disabled, testID }: any) => (
    <TouchableOpacity
      testID={testID || 'circle-btn'}
      onPress={onPress}
      disabled={disabled}
    />
  );
});

import ModelCard from '../components/model-hub/ModelCard';
import { useModelStore, ModelState } from '../store/modelStore';
import { isModelCompatible } from '../utils/modelCompatibility';

const mockUseModelStore = useModelStore as jest.Mock;
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

const renderCard = (
  props: Partial<
    typeof baseModel & {
      compactView?: boolean;
      selected?: boolean;
      onPress?: any;
      wifiWarningSheetRef?: any;
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
  mockUseModelStore.mockReturnValue({
    downloadStates: {},
    downloadModel: jest.fn(),
    cancelDownload: jest.fn(),
  });
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

  it('shows parameters chip', () => {
    renderCard();
    expect(screen.getByTestId('chip-3.21 B')).toBeTruthy();
  });

  it('shows model size chip', () => {
    renderCard();
    expect(screen.getByTestId('chip-2.50 GB')).toBeTruthy();
  });

  it('shows Incompatible chip when model is not compatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard();
    expect(screen.getByTestId('chip-Incompatible')).toBeTruthy();
  });

  it('shows Vision chip when model supports vision', () => {
    renderCard({ vision: true });
    expect(screen.getByTestId('chip-Vision')).toBeTruthy();
  });

  it('does not show Vision chip when model does not support vision', () => {
    renderCard({ vision: false });
    expect(screen.queryByTestId('chip-Vision')).toBeNull();
  });

  it('renders label chips from model.labels', () => {
    renderCard({ compactView: false, labels: ['Fast', 'Reasoning'] });
    expect(screen.getByTestId('chip-Fast')).toBeTruthy();
    expect(screen.getByTestId('chip-Reasoning')).toBeTruthy();
  });

  it('omits label chips in compact view', () => {
    renderCard({ compactView: true, labels: ['Fast'] });
    expect(screen.queryByTestId('chip-Fast')).toBeNull();
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
    mockUseModelStore.mockReturnValue({
      downloadStates: { 1: { status: ModelState.NotStarted, progress: 0 } },
      downloadModel: jest.fn(),
      cancelDownload: jest.fn(),
    });
    renderCard();
    expect(screen.getByTestId('circle-btn')).toBeTruthy();
  });

  it('shows progress bar when Downloading', () => {
    mockUseModelStore.mockReturnValue({
      downloadStates: { 1: { status: ModelState.Downloading, progress: 0.4 } },
      downloadModel: jest.fn(),
      cancelDownload: jest.fn(),
    });
    renderCard();
    expect(screen.getByText('40%')).toBeTruthy();
  });

  it('does not show download button when already downloaded', () => {
    mockUseModelStore.mockReturnValue({
      downloadStates: { 1: { status: ModelState.Downloaded, progress: 1 } },
      downloadModel: jest.fn(),
      cancelDownload: jest.fn(),
    });
    renderCard({ isDownloaded: true });
    expect(screen.queryByTestId('circle-btn')).toBeNull();
  });
});

// ─── download action ──────────────────────────────────────────────────────────

describe('download action', () => {
  it('calls downloadModel when download button pressed on wifi', async () => {
    const downloadModel = jest.fn().mockResolvedValue(undefined);
    mockUseModelStore.mockReturnValue({
      downloadStates: {},
      downloadModel,
      cancelDownload: jest.fn(),
    });
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
    mockUseModelStore.mockReturnValue({
      downloadStates: { 1: { status: ModelState.Downloading, progress: 0.5 } },
      downloadModel: jest.fn(),
      cancelDownload,
    });
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
    const wifiWarningSheetRef = { current: { present } };
    renderCard({ wifiWarningSheetRef });
    fireEvent.press(screen.getByTestId('circle-btn'));
    await waitFor(() => expect(present).toHaveBeenCalled());
  });
});
