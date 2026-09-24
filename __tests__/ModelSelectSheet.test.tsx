import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Model } from '../database/modelRepository';

type ModelStoreMockState = { downloadedModels: Model[] };

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
  useModelStore: jest.fn(
    (selector?: (state: ModelStoreMockState) => unknown) => {
      const state: ModelStoreMockState = { downloadedModels: [] };
      return selector ? selector(state) : state;
    }
  ),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('../components/model-hub/ModelCard', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({
    model,
    onPress,
  }: {
    model: Model;
    onPress: (model: Model) => void;
  }) => (
    <TouchableOpacity
      testID={`model-card-${model.id}`}
      onPress={() => onPress(model)}
    >
      <Text>{model.modelName}</Text>
    </TouchableOpacity>
  );
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
  }: {
    data: Model[];
    renderItem: (info: { item: Model }) => React.ReactNode;
  }) => (
    <View>
      {data.map((item, i) => (
        <View key={i}>{renderItem({ item })}</View>
      ))}
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
import { useModelStore } from '../store/modelStore';
import { router } from 'expo-router';

const mockUseModelStore = useModelStore as unknown as jest.Mock;

const withDownloadedModels = (downloadedModels: Model[]) =>
  mockUseModelStore.mockImplementation(
    (selector?: (state: ModelStoreMockState) => unknown) => {
      const state: ModelStoreMockState = { downloadedModels };
      return selector ? selector(state) : state;
    }
  );

const makeModel = (id: number, name: string) => ({
  id,
  modelName: name,
  source: 'remote' as const,
  isDownloaded: true,
  featured: false,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
});

beforeEach(() => {
  withDownloadedModels([]);
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

  it('navigates to model-hub when "Download a Model" pressed', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Download a Model'));
    expect(router.replace).toHaveBeenCalledWith('/model-hub');
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('with downloaded models', () => {
  beforeEach(() => {
    withDownloadedModels([makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')]);
  });

  it('shows "Select a Model" title', () => {
    renderSheet();
    expect(screen.getByText('Select a Model')).toBeTruthy();
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

  it('reports the pick and dismisses, leaving the load to the caller', () => {
    const onModelPicked = jest.fn();
    const onSheetStateChange = jest.fn();
    renderSheet({ onModelPicked, onSheetStateChange });

    fireEvent.press(screen.getByTestId('model-card-1'));

    expect(onModelPicked).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
    expect(onSheetStateChange).toHaveBeenLastCalledWith(false);
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
});
