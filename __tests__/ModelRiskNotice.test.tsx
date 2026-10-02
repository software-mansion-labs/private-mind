import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('../utils/modelCompatibility', () => ({
  getModelRisk: jest.fn(() => ({ tier: 'ok', reason: 'fits' })),
}));

import { router } from 'expo-router';
import ModelRiskNotice from '../components/chat-screen/ModelRiskNotice';
import { getModelRisk } from '../utils/modelCompatibility';
import { useModelRiskNoticeStore } from '../store/modelRiskNoticeStore';

const mockGetModelRisk = getModelRisk as jest.Mock;

const model = {
  id: 3,
  modelName: 'Qwen 3 - 1.7B',
  source: 'built-in' as const,
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
};

describe('ModelRiskNotice', () => {
  beforeEach(() => {
    useModelRiskNoticeStore.setState({ dismissedModelIds: [] });
    mockGetModelRisk.mockReturnValue({ tier: 'ok', reason: 'fits' });
  });

  it('renders nothing for a comfortable model', () => {
    render(<ModelRiskNotice model={model} />);
    expect(screen.queryByTestId('chat-model-risk-notice')).toBeNull();
  });

  it('renders nothing when no downloaded model is selected', () => {
    mockGetModelRisk.mockReturnValue({ tier: 'unsafe', reason: 'over-budget' });
    render(<ModelRiskNotice model={{ ...model, isDownloaded: false }} />);
    expect(screen.queryByTestId('chat-model-risk-notice')).toBeNull();
  });

  it('warns about a tight fit, names the model, and opens the benchmark for it', () => {
    mockGetModelRisk.mockReturnValue({
      tier: 'tight',
      reason: 'little-headroom',
    });
    render(<ModelRiskNotice model={model} />);
    expect(screen.getByText('Tight fit for this device')).toBeTruthy();
    expect(screen.getByText(/Qwen 3 - 1\.7B fits in memory/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('chat-model-risk-notice-action'));
    expect(router.push).toHaveBeenCalledWith('/benchmark?modelId=3');
  });

  it('stays dismissed for that model only', () => {
    mockGetModelRisk.mockReturnValue({ tier: 'unsafe', reason: 'over-budget' });
    render(<ModelRiskNotice model={model} />);
    fireEvent.press(screen.getByTestId('chat-model-risk-notice-dismiss'));
    expect(screen.queryByTestId('chat-model-risk-notice')).toBeNull();
    expect(useModelRiskNoticeStore.getState().dismissedModelIds).toEqual([3]);

    render(<ModelRiskNotice model={{ ...model, id: 4 }} />);
    expect(screen.getByTestId('chat-model-risk-notice')).toBeTruthy();
  });
});
