import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

let mockParams: { modelId?: string } = {};
const mockSetParams = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ setParams: mockSetParams }),
}));

jest.mock('expo-router/react-navigation', () => ({
  useHeaderHeight: () => 0,
}));

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const mockModels = [
  { id: 1, modelName: 'Model A' },
  { id: 2, modelName: 'Model B' },
  { id: 3, modelName: 'Model C' },
];

jest.mock('../store/modelStore', () => ({
  useModelStore: () => ({
    getModelById: (id: number) => mockModels.find((m) => m.id === id),
  }),
}));

jest.mock('../database/benchmarkRepository', () => ({
  getAllBenchmarks: jest.fn().mockResolvedValue([]),
  getBenchmarkById: jest.fn(),
  deleteBenchmark: jest.fn(),
}));

jest.mock('../hooks/useBenchmarkRunner', () => () => ({
  isRunning: false,
  isSuccess: false,
  timer: 0,
  startBenchmark: jest.fn(),
  cancelBenchmark: jest.fn(),
}));

jest.mock('../hooks/useDefaultHeader', () => () => {});

jest.mock('../components/benchmark/BenchmarkModal', () => ({
  BenchmarkModal: () => null,
}));
jest.mock('../components/bottomSheets/BenchmarkResultSheet', () => () => null);
jest.mock('../components/benchmark/BenchmarkHistory', () => () => null);

jest.mock('../components/benchmark/ModelSelector', () => {
  const { Pressable, Text } = require('react-native');
  return {
    ModelSelector: ({
      model,
      onSelect,
    }: {
      model?: { modelName: string };
      onSelect: (model: { id: number; modelName: string }) => void;
    }) => (
      <>
        <Text testID="selected-model">{model?.modelName ?? 'none'}</Text>
        <Pressable
          testID="pick-model-c"
          onPress={() => onSelect({ id: 3, modelName: 'Model C' })}
        />
      </>
    ),
  };
});

import BenchmarkScreen from '../app/(drawer)/benchmark';

const selectedName = () =>
  screen.getByTestId('selected-model').props.children as string;

const renderScreen = async () => {
  const result = render(<BenchmarkScreen />);
  await act(async () => {});
  return result;
};

beforeEach(() => {
  mockParams = {};
  mockSetParams.mockClear();
});

describe('BenchmarkScreen model selection', () => {
  it('shows no model when opened without a modelId', async () => {
    await renderScreen();
    expect(selectedName()).toBe('none');
  });

  it('follows the modelId param while the screen stays mounted', async () => {
    mockParams = { modelId: '1' };
    const { rerender } = await renderScreen();
    expect(selectedName()).toBe('Model A');

    mockParams = { modelId: '2' };
    rerender(<BenchmarkScreen />);
    expect(selectedName()).toBe('Model B');

    mockParams = { modelId: '1' };
    rerender(<BenchmarkScreen />);
    expect(selectedName()).toBe('Model A');
  });

  it('writes a manually picked model into the route params', async () => {
    mockParams = { modelId: '1' };
    await renderScreen();

    fireEvent.press(screen.getByTestId('pick-model-c'));

    expect(mockSetParams).toHaveBeenCalledWith({ modelId: '3' });
  });
});
