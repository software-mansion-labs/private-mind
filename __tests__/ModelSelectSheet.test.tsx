import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Model } from '../database/modelRepository';

type ModelStoreMockState = {
  downloadedModels: Model[];
  downloadStates: Record<number, { status: string; progress: number }>;
};

type SheetHandle = {
  dismiss: () => void;
  snapToIndex: (index: number) => void;
};

type SheetModalProps = {
  index?: number;
  children?: React.ReactNode;
  onChange?: (index: number) => void;
  onDismiss?: () => void;
};

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/modelStore', () => ({
  ModelState: { Downloading: 'downloading' },
  useModelStore: jest.fn(
    (selector?: (state: ModelStoreMockState) => unknown) => {
      const state: ModelStoreMockState = {
        downloadedModels: [],
        downloadStates: {},
      };
      return selector ? selector(state) : state;
    }
  ),
}));

const mockUpdateModel = jest.fn();
jest.mock('../hooks/useModelUpdate', () => ({
  useModelUpdate: () => ({
    updateModel: mockUpdateModel,
    ConfirmElement: null,
  }),
}));

let mockPathname = '/chat/3';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() },
  usePathname: () => mockPathname,
}));

jest.mock('../components/model-hub/ModelFamilyTile', () => ({
  __esModule: true,
  default: () => null,
  familyTileSize: () => 40,
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { Pressable: RN.Pressable };
});

jest.mock('../components/bottomSheets/BottomSheetSearchInput', () => {
  const { TextInput } = require('react-native');
  return ({
    value,
    onChangeText,
    placeholder,
  }: {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
  }) => (
    <TextInput
      testID="search-input"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = ReactMock.forwardRef(
    (props: SheetModalProps, ref: React.Ref<SheetHandle>) => {
      ReactMock.useImperativeHandle(ref, () => ({
        dismiss: () => props.onDismiss?.(),
        snapToIndex: (i: number) => props.onChange?.(i),
      }));
      const emitInitialDetent = ReactMock.useRef(props.onChange);
      emitInitialDetent.current = props.onChange;
      ReactMock.useEffect(() => {
        emitInitialDetent.current?.(0);
      }, []);
      return (
        <View testID="sheet-modal" index={props.index}>
          {props.children}
        </View>
      );
    }
  );
  const BottomSheetFlatList = ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
  }: {
    data: Model[];
    renderItem: (info: { item: Model }) => React.ReactNode;
    ListEmptyComponent?: React.ReactNode;
    ListFooterComponent?: React.ReactNode;
  }) => (
    <View>
      {data.length === 0
        ? ListEmptyComponent
        : data.map((item, i) => <View key={i}>{renderItem({ item })}</View>)}
      {ListFooterComponent}
    </View>
  );
  const BottomSheetView = ({
    children,
    style,
  }: {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
  }) => <View style={style}>{children}</View>;
  const BottomSheetBackdrop = () => null;

  return {
    BottomSheetModal,
    BottomSheetFlatList,
    BottomSheetView,
    BottomSheetBackdrop,
  };
});

import ModelSelectSheet from '../components/bottomSheets/ModelSelectSheet';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { DIMMED_OPACITY } from '../styles/pressable';
import { useModelStore } from '../store/modelStore';
import { router } from 'expo-router';

const mockUseModelStore = useModelStore as unknown as jest.Mock;

const withDownloadedModels = (
  downloadedModels: Model[],
  downloadStates: ModelStoreMockState['downloadStates'] = {}
) =>
  mockUseModelStore.mockImplementation(
    (selector?: (state: ModelStoreMockState) => unknown) => {
      const state: ModelStoreMockState = { downloadedModels, downloadStates };
      return selector ? selector(state) : state;
    }
  );

const makeModel = (
  id: number,
  name: string,
  overrides: Partial<Model> = {}
) => ({
  id,
  modelName: name,
  source: 'remote' as const,
  isDownloaded: true,
  featured: false,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  ...overrides,
});

beforeEach(() => {
  withDownloadedModels([]);
  mockPathname = '/chat/3';
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

type SheetProps = React.ComponentProps<typeof ModelSelectSheet>;

const renderSheet = (props: Partial<SheetProps> = {}) =>
  render(
    <ModelSelectSheet
      bottomSheetModalRef={createRef()}
      onModelPicked={jest.fn()}
      {...props}
    />
  );

const renderSheetWithHandle = () => {
  const ref = createRef<SheetHandle>();
  renderSheet({
    bottomSheetModalRef: ref as unknown as SheetProps['bottomSheetModalRef'],
  });
  return ref;
};

describe('empty state', () => {
  it('shows empty state message when no models downloaded', () => {
    renderSheet();
    expect(screen.getByText('You have no available models yet')).toBeTruthy();
  });

  it('shows "Download a Model" button in empty state', () => {
    renderSheet();
    expect(screen.getByText('Download a Model')).toBeTruthy();
  });

  it('opens model-hub over the chat when "Download a Model" pressed', () => {
    mockPathname = '/chat/3';
    renderSheet();
    fireEvent.press(screen.getByText('Download a Model'));
    expect(router.push).toHaveBeenCalledWith('/model-hub');
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('goes back to model-hub instead of opening a second one from inside it', () => {
    mockPathname = '/model-hub/benchmark';
    renderSheet();
    fireEvent.press(screen.getByText('Download a Model'));
    expect(router.dismissTo).toHaveBeenCalledWith('/model-hub');
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('with downloaded models', () => {
  beforeEach(() => {
    withDownloadedModels([makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')]);
  });

  it('shows "Select a model" title', () => {
    renderSheet();
    expect(screen.getByText('Select a model')).toBeTruthy();
  });

  it('renders all downloaded models', () => {
    renderSheet();
    expect(screen.getByText('Llama-3B')).toBeTruthy();
    expect(screen.getByText('Qwen-1B')).toBeTruthy();
  });

  it('keeps the detent the user dragged to, so a re-render cannot collapse it', () => {
    const ref = renderSheetWithHandle();

    expect(screen.getByTestId('sheet-modal').props.index).toBe(0);

    act(() => ref.current!.snapToIndex(1));

    expect(screen.getByTestId('sheet-modal').props.index).toBe(1);
  });

  it('reopens at the first detent after being dismissed', () => {
    const ref = renderSheetWithHandle();

    act(() => ref.current!.snapToIndex(1));
    act(() => ref.current!.dismiss());

    expect(screen.getByTestId('sheet-modal').props.index).toBe(0);
  });

  it('opens the models screen from the link under the list and dismisses', () => {
    const onSheetStateChange = jest.fn();
    renderSheet({ onSheetStateChange });

    fireEvent.press(screen.getByTestId('model-select-see-all'));

    expect(router.replace).toHaveBeenCalledWith('/model-hub');
    expect(onSheetStateChange).toHaveBeenLastCalledWith(false);
  });

  it('reports the pick and dismisses, leaving the load to the caller', () => {
    const onModelPicked = jest.fn();
    const onSheetStateChange = jest.fn();
    renderSheet({ onModelPicked, onSheetStateChange });

    fireEvent.press(screen.getByTestId('model-select-row-1'));

    expect(onModelPicked).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
    expect(onSheetStateChange).toHaveBeenLastCalledWith(false);
  });
});

describe('current model', () => {
  beforeEach(() => {
    withDownloadedModels([makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')]);
  });

  it('checks only the current model', () => {
    renderSheet({ currentModelId: 2 });
    expect(
      screen.getByTestId('model-select-row-2').props.accessibilityState.checked
    ).toBe(true);
    expect(
      screen.getByTestId('model-select-row-1').props.accessibilityState.checked
    ).toBe(false);
    expect(screen.getAllByTestId('model-select-current')).toHaveLength(1);
  });

  it('checks nothing when no model is current', () => {
    renderSheet();
    expect(screen.queryByTestId('model-select-current')).toBeNull();
  });
});

describe('models that need an update', () => {
  const outdated = (updateRequired: boolean) =>
    makeModel(1, 'Llama-3B', { outdatedSources: ['old.pte'], updateRequired });

  it('lists models whose update is required in their own section after the rest', () => {
    withDownloadedModels([outdated(true), makeModel(2, 'Qwen-1B')]);
    renderSheet();

    const order = screen
      .getAllByText(
        new RegExp(
          `^(Llama-3B|Qwen-1B|${MODEL_UPDATE_TEXT.pickerSectionTitle})$`
        )
      )
      .map((node) => node.props.children);

    expect(order).toEqual([
      'Qwen-1B',
      MODEL_UPDATE_TEXT.pickerSectionTitle,
      'Llama-3B',
    ]);
    expect(screen.getByText(MODEL_UPDATE_TEXT.pickerSectionBody)).toBeTruthy();
  });

  it('disables a model whose update is required', () => {
    const onModelPicked = jest.fn();
    withDownloadedModels([outdated(true)]);
    renderSheet({ onModelPicked });

    const row = screen.getByTestId('model-select-row-1');
    expect(row.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Llama-3B').parent?.parent).toHaveStyle({
      opacity: DIMMED_OPACITY,
    });
    expect(screen.getByTestId('model-select-update-1')).not.toHaveStyle({
      opacity: DIMMED_OPACITY,
    });

    fireEvent.press(row);
    expect(onModelPicked).not.toHaveBeenCalled();
  });

  it('drops the section when the search leaves no model that needs an update', () => {
    withDownloadedModels([outdated(true), makeModel(2, 'Qwen-1B')]);
    renderSheet();

    fireEvent.changeText(screen.getByTestId('search-input'), 'qwen');

    expect(screen.queryByText(MODEL_UPDATE_TEXT.pickerSectionTitle)).toBeNull();
  });

  it('updates the model straight from the sheet', () => {
    const onModelPicked = jest.fn();
    withDownloadedModels([outdated(true)]);
    renderSheet({ onModelPicked });

    fireEvent.press(screen.getByTestId('model-select-update-1'));

    expect(mockUpdateModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
    expect(onModelPicked).not.toHaveBeenCalled();
  });

  it('shows update progress in place of the button label', () => {
    withDownloadedModels([outdated(true)], {
      1: { status: 'downloading', progress: 0.42 },
    });
    renderSheet();

    const button = screen.getByTestId('model-select-update-1');
    expect(screen.getByText('42%')).toBeTruthy();
    expect(button.props.accessibilityState.busy).toBe(true);
  });

  it('keeps a model with only an optional update selectable', () => {
    const onModelPicked = jest.fn();
    withDownloadedModels([outdated(false)]);
    renderSheet({ onModelPicked });

    const row = screen.getByTestId('model-select-row-1');
    expect(row.props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByText(MODEL_UPDATE_TEXT.pickerSectionTitle)).toBeNull();
    expect(screen.queryByTestId('model-select-update-1')).toBeNull();

    fireEvent.press(row);
    expect(onModelPicked).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
  });
});

describe('search filtering', () => {
  beforeEach(() => {
    withDownloadedModels([makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')]);
  });

  it('filters models based on search input', () => {
    renderSheet();
    fireEvent.changeText(screen.getByTestId('search-input'), 'qwen');
    expect(screen.queryByText('Llama-3B')).toBeNull();
    expect(screen.getByText('Qwen-1B')).toBeTruthy();
  });

  it('search is case-insensitive', () => {
    renderSheet();
    fireEvent.changeText(screen.getByTestId('search-input'), 'LLAMA');
    expect(screen.getByText('Llama-3B')).toBeTruthy();
    expect(screen.queryByText('Qwen-1B')).toBeNull();
  });

  it('shows all models when search is cleared', () => {
    renderSheet();
    fireEvent.changeText(screen.getByTestId('search-input'), 'llama');
    fireEvent.changeText(screen.getByTestId('search-input'), '');
    expect(screen.getByText('Llama-3B')).toBeTruthy();
    expect(screen.getByText('Qwen-1B')).toBeTruthy();
  });

  it('shows a no-match state when nothing matches the search', () => {
    renderSheet();
    fireEvent.changeText(screen.getByTestId('search-input'), 'mistral');
    expect(screen.getByText('No models match "mistral"')).toBeTruthy();
    expect(screen.getByText('Manage models')).toBeTruthy();
  });

  it('drops the see-all link when nothing matches, leaving the no-match action', () => {
    renderSheet();
    fireEvent.changeText(screen.getByTestId('search-input'), 'mistral');
    expect(screen.queryByTestId('model-select-see-all')).toBeNull();
  });

  it('opens model hub from the no-match state', () => {
    const onSheetStateChange = jest.fn();
    renderSheet({ onSheetStateChange });
    fireEvent.changeText(screen.getByTestId('search-input'), 'mistral');
    fireEvent.press(screen.getByTestId('model-select-empty-manage-models'));
    expect(router.push).toHaveBeenCalledWith('/model-hub');
    expect(onSheetStateChange).toHaveBeenLastCalledWith(false);
  });
});
