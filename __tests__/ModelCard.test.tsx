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

type ModelCardProps = React.ComponentProps<typeof ModelCard>;

const renderCard = (
  props: Partial<
    typeof baseModel & {
      compactView?: boolean;
      selected?: boolean;
      checkable?: boolean;
      showFamilyIcon?: boolean;
      downloadStatus?: ModelCardProps['downloadStatus'];
      locked?: boolean;
      onCancel?: ModelCardProps['onCancel'];
      onDeleted?: ModelCardProps['onDeleted'];
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
      checkable={props.checkable}
      showFamilyIcon={props.showFamilyIcon}
      downloadStatus={props.downloadStatus}
      locked={props.locked}
      onCancel={props.onCancel}
      onDeleted={props.onDeleted}
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

  it('shows model size and parameters on one meta line', () => {
    renderCard();
    expect(screen.getByText('2.50 GB · 3.21 B')).toBeTruthy();
  });

  it('shows no family tile by default', () => {
    renderCard();
    expect(screen.queryByTestId('model-family-tile')).toBeNull();
  });

  it('shows Incompatible badge when model is not compatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard();
    expect(screen.getByTestId('model-badge-Incompatible')).toBeTruthy();
  });

  it('shows Vision badge when model supports vision', () => {
    renderCard({ vision: true });
    expect(screen.getByTestId('model-badge-Vision')).toBeTruthy();
  });

  it('does not show Vision badge when model does not support vision', () => {
    renderCard({ vision: false });
    expect(screen.queryByTestId('model-badge-Vision')).toBeNull();
  });

  it('renders label badges from model.labels', () => {
    renderCard({ compactView: false, labels: ['Fast', 'Reasoning'] });
    expect(screen.getByTestId('model-badge-Fast')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Reasoning')).toBeTruthy();
  });

  it('omits label badges in compact view', () => {
    renderCard({ compactView: true, labels: ['Fast'] });
    expect(screen.queryByTestId('model-badge-Fast')).toBeNull();
  });

  it('shows a Thinking badge for a thinking model, even in compact view', () => {
    renderCard({ thinking: true, compactView: true });
    expect(screen.getByTestId('model-badge-Thinking')).toBeTruthy();
  });

  it('keeps the Reasoning label next to the Thinking badge', () => {
    renderCard({ thinking: true, compactView: false, labels: ['Reasoning'] });
    expect(screen.getByTestId('model-badge-Thinking')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Reasoning')).toBeTruthy();
  });

  it('does not repeat a capability that the catalog also lists as a label', () => {
    renderCard({ vision: true, compactView: false, labels: ['Vision'] });
    expect(screen.getAllByTestId('model-badge-Vision')).toHaveLength(1);
  });

  it('shows the family icon in the tile when asked to', () => {
    renderCard({ modelName: 'Qwen 3 - 1.7B', showFamilyIcon: true });
    expect(
      screen.getByTestId('model-family-icon', { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it('shows the first letter of a family without an icon', () => {
    renderCard({ modelName: 'Bielik - v3.0', showFamilyIcon: true });
    expect(
      screen.queryByTestId('model-family-icon', { includeHiddenElements: true })
    ).toBeNull();
    expect(screen.getByText('B', { includeHiddenElements: true })).toBeTruthy();
  });

  it('keeps the family tile out of the screen reader, the name already says it', () => {
    renderCard({ modelName: 'Bielik - v3.0', showFamilyIcon: true });
    expect(screen.queryByText('B')).toBeNull();
  });

  it('shows a label the app does not know yet', () => {
    renderCard({ compactView: false, labels: ['Multilingual'] });
    expect(screen.getByTestId('model-badge-Multilingual')).toBeTruthy();
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

  it('does not show download button when already downloaded', () => {
    withDownloadStates({
      1: { status: ModelState.Downloaded, progress: 1 },
    });
    renderCard({ isDownloaded: true });
    expect(screen.queryByTestId('circle-btn')).toBeNull();
  });
});

// ─── checkable ────────────────────────────────────────────────────────────────

describe('checkable', () => {
  it('shows a checkbox instead of the download button', () => {
    renderCard({ checkable: true });
    expect(screen.getByTestId('model-card-checkbox')).toBeTruthy();
    expect(screen.queryByTestId('circle-btn')).toBeNull();
  });

  it('has no checkbox by default', () => {
    renderCard();
    expect(screen.queryByTestId('model-card-checkbox')).toBeNull();
  });

  it('reports the checked state to accessibility', () => {
    renderCard({ checkable: true, selected: true });
    expect(screen.getByRole('checkbox', { checked: true })).toBeTruthy();
  });

  it('can be toggled before the model is downloaded', () => {
    const onPress = jest.fn();
    renderCard({ checkable: true, source: 'built-in', onPress });
    fireEvent.press(screen.getByText('Llama-3B'));
    expect(onPress).toHaveBeenCalled();
  });

  it('is disabled when the model is incompatible', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard({ checkable: true });
    expect(screen.getByRole('checkbox', { disabled: true })).toBeTruthy();
  });
});

// ─── selection download ───────────────────────────────────────────────────────

describe('selection download', () => {
  it('shows no progress row before downloading starts', () => {
    renderCard({ checkable: true, selected: true });
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByTestId('model-card-cancel')).toBeNull();
  });

  it('shows the percentage of the model being downloaded', () => {
    withDownloadStates({
      1: { status: ModelState.Downloading, progress: 0.7 },
    });
    renderCard({
      checkable: true,
      selected: true,
      downloadStatus: 'downloading',
    });
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('labels a finished model as Done', () => {
    renderCard({ checkable: true, selected: true, downloadStatus: 'done' });
    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('cancels a downloading model', () => {
    const onCancel = jest.fn();
    renderCard({
      checkable: true,
      selected: true,
      downloadStatus: 'downloading',
      onCancel,
    });
    fireEvent.press(screen.getByTestId('model-card-cancel'));
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('offers no cancel once the model is done', () => {
    renderCard({ checkable: true, selected: true, downloadStatus: 'done' });
    expect(screen.queryByTestId('model-card-cancel')).toBeNull();
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
    renderCard({
      checkable: true,
      selected: true,
      downloadStatus: 'done',
      onDeleted,
    });
    fireEvent.press(screen.getByTestId('model-card-delete'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(removeModelFiles).toHaveBeenCalledWith(1);
  });

  it('is disabled while downloads run', () => {
    renderCard({ checkable: true, locked: true });
    expect(screen.getByRole('checkbox', { disabled: true })).toBeTruthy();
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

describe('model card for a screen reader', () => {
  const actionsOf = (role: 'button' | 'checkbox') =>
    screen
      .getByRole(role, { name: /Llama-3B/ })
      .props.accessibilityActions.map(
        (action: { name: string }) => action.name
      );
  const perform = (role: 'button' | 'checkbox', actionName: string) =>
    fireEvent(
      screen.getByRole(role, { name: /Llama-3B/ }),
      'accessibilityAction',
      { nativeEvent: { actionName } }
    );

  it('offers a Download action that starts the download', async () => {
    const downloadModel = jest.fn().mockResolvedValue(undefined);
    withDownloadStates({}, { downloadModel });
    renderCard();
    expect(actionsOf('button')).toEqual(['download']);
    perform('button', 'download');
    await waitFor(() =>
      expect(downloadModel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      )
    );
  });

  it('keeps a bundled model that is not downloaded yet from reading as dimmed, since it can be downloaded', () => {
    renderCard({ source: 'built-in' });
    expect(
      screen.getByRole('button', { name: /Llama-3B/ }).props.accessibilityState
    ).toEqual(expect.objectContaining({ disabled: false }));
  });

  it('offers no Download action for a model the device cannot run', () => {
    mockIsModelCompatible.mockReturnValue(false);
    renderCard();
    expect(actionsOf('button')).toEqual([]);
  });

  it('offers Cancel download while the model is downloading', async () => {
    const cancelDownload = jest.fn().mockResolvedValue(undefined);
    withDownloadStates(
      { 1: { status: ModelState.Downloading, progress: 0.5 } },
      { cancelDownload }
    );
    renderCard();
    expect(actionsOf('button')).toEqual(['cancelDownload']);
    perform('button', 'cancelDownload');
    await waitFor(() =>
      expect(cancelDownload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 })
      )
    );
  });

  it('offers Delete model files where the card shows the delete button', () => {
    withDownloadStates({ 1: { status: ModelState.Downloaded, progress: 1 } });
    render(
      <ModelCard
        model={{ ...baseModel, isDownloaded: true }}
        onPress={jest.fn()}
        showDeleteButton
      />
    );
    expect(actionsOf('button')).toEqual(['delete']);
  });

  it('lets the starting-model picker cancel a model it is downloading', () => {
    const onCancel = jest.fn();
    renderCard({
      checkable: true,
      selected: true,
      downloadStatus: 'downloading',
      onCancel,
    });
    expect(actionsOf('checkbox')).toEqual(['cancelDownload']);
    perform('checkbox', 'cancelDownload');
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('lets the starting-model picker delete a model it has finished', () => {
    renderCard({ checkable: true, selected: true, downloadStatus: 'done' });
    expect(actionsOf('checkbox')).toEqual(['delete']);
  });
});
