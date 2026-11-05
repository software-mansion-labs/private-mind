import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ModelUpdateBanner from '../components/chat-screen/ModelUpdateBanner';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';
import { ModelState, useModelStore } from '../store/modelStore';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const qwen: Model = {
  id: 1,
  modelName: 'Qwen 3 - 0.6B',
  source: 'built-in',
  isDownloaded: true,
  modelPath: 'https://hf.example/v0.11.0/qwen.pte',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  outdatedSources: ['https://hf.example/v0.9.0/qwen.pte'],
};

const updateOutdatedModel = jest.fn(() => Promise.resolve());
const downloadModel = jest.fn(() => Promise.resolve());

beforeEach(() => {
  updateOutdatedModel.mockClear();
  downloadModel.mockClear();
  useModelStore.setState({
    downloadStates: {},
    updateOutdatedModel,
    downloadModel,
  });
});

describe('the update banner above the composer', () => {
  it('names the chat model and updates it on tap', () => {
    render(<ModelUpdateBanner model={qwen} />);

    expect(
      screen.getByText(MODEL_UPDATE_TEXT.chatBanner('Qwen 3 - 0.6B'))
    ).toBeTruthy();
    fireEvent.press(screen.getByText(MODEL_UPDATE_TEXT.chatBannerAction));
    expect(updateOutdatedModel).toHaveBeenCalledWith(qwen);
  });

  it('shows the download progress instead of the button while it updates', () => {
    useModelStore.setState({
      downloadStates: { 1: { status: ModelState.Downloading, progress: 0.25 } },
    });

    render(<ModelUpdateBanner model={qwen} />);

    expect(screen.getByText('25%')).toBeTruthy();
  });

  it('offers the successor of a removed model for download', () => {
    const spinQuant = {
      ...qwen,
      id: 8,
      modelName: 'LLaMA 3.2 - 1B - SpinQuant',
      isDownloaded: false,
      outdatedSources: undefined,
    };

    render(
      <ModelUpdateBanner model={spinQuant} replaces="LLaMA 3.2 - 1B - QLoRa" />
    );

    expect(
      screen.getByText(
        MODEL_UPDATE_TEXT.replacementBanner(
          'LLaMA 3.2 - 1B - QLoRa',
          'LLaMA 3.2 - 1B - SpinQuant'
        )
      )
    ).toBeTruthy();
    fireEvent.press(
      screen.getByText(MODEL_UPDATE_TEXT.replacementBannerAction)
    );
    expect(downloadModel).toHaveBeenCalledWith(spinQuant);
  });
});
