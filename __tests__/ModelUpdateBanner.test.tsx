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

beforeEach(() => {
  updateOutdatedModel.mockClear();
  useModelStore.setState({ downloadStates: {}, updateOutdatedModel });
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
});
