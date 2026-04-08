import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/modelStore', () => ({
  useModelStore: jest.fn(() => ({ downloadedModels: [] })),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('../components/model-hub/ModelCard', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return ({ model, onPress }: any) => (
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
  return ({ value, onChangeText, placeholder }: any) => (
    <TextInput
      testID="search-input"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
    />
  );
});

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const _data: any = null;

  const BottomSheetModal = React.forwardRef((props: any, _ref: any) => (
    <View>{props.children}</View>
  ));
  const BottomSheetFlatList = ({ data, renderItem }: any) => (
    <View>
      {data.map((item: any, i: number) => (
        <View key={i}>{renderItem({ item })}</View>
      ))}
    </View>
  );
  const BottomSheetView = ({ children, style }: any) => (
    <View style={style}>{children}</View>
  );
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

const mockUseModelStore = useModelStore as jest.Mock;

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
  mockUseModelStore.mockReturnValue({ downloadedModels: [] });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const renderSheet = (props = {}) =>
  render(
    <ModelSelectSheet
      bottomSheetModalRef={createRef()}
      selectModel={jest.fn()}
      {...props}
    />
  );

// ─── empty state ──────────────────────────────────────────────────────────────

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
    expect(router.push).toHaveBeenCalledWith('/model-hub');
  });
});

// ─── with models ──────────────────────────────────────────────────────────────

describe('with downloaded models', () => {
  beforeEach(() => {
    mockUseModelStore.mockReturnValue({
      downloadedModels: [makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')],
    });
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

  it('calls selectModel when a model card is pressed', () => {
    const selectModel = jest.fn();
    renderSheet({ selectModel });
    fireEvent.press(screen.getByTestId('model-card-1'));
    expect(selectModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    );
  });
});

// ─── search filtering ─────────────────────────────────────────────────────────

describe('search filtering', () => {
  beforeEach(() => {
    mockUseModelStore.mockReturnValue({
      downloadedModels: [makeModel(1, 'Llama-3B'), makeModel(2, 'Qwen-1B')],
    });
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
