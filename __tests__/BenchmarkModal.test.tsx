import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/SpinningCircleTimer', () => ({
  SpinningCircleTimer: () => null,
}));

jest.mock('../utils/modelCompatibility', () => ({
  isModelCompatible: jest.fn(() => true),
}));

import { BenchmarkModal } from '../components/benchmark/BenchmarkModal';
import { Model } from '../database/modelRepository';

const model = {
  id: 1,
  modelName: 'Qwen 3 - 1.7B',
  source: 'built-in',
  isDownloaded: true,
  featured: false,
  parameters: 1.72,
  modelSize: 1.07,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: true,
  labels: [],
} as unknown as Model;

const renderModal = (selectedModel?: Model) =>
  render(
    <BenchmarkModal
      isVisible
      handleCancel={jest.fn()}
      showSuccess={false}
      timer={0}
      selectedModel={selectedModel}
    />
  );

describe('BenchmarkModal', () => {
  it('renders before a model is picked', () => {
    renderModal();
    expect(screen.getByText('Running a benchmark')).toBeTruthy();
  });

  it('shows the model being benchmarked', () => {
    renderModal(model);
    expect(screen.getByText('Qwen 3 - 1.7B')).toBeTruthy();
    expect(screen.getByText('1.07 GB · 1.72 B')).toBeTruthy();
    expect(screen.getByTestId('model-badge-Thinking')).toBeTruthy();
  });
});
