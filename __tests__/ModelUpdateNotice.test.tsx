import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ModelUpdateNotice from '../components/ModelUpdateNotice';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';
import { ModelState, useModelStore } from '../store/modelStore';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const model = (id: number, overrides: Partial<Model> = {}): Model => ({
  id,
  modelName: `Model ${id}`,
  source: 'built-in',
  isDownloaded: true,
  modelPath: `https://hf.example/v0.11.0/${id}.pte`,
  tokenizerPath: 'https://hf.example/v0.11.0/tokenizer.json',
  tokenizerConfigPath: 'https://hf.example/v0.11.0/tokenizer_config.json',
  modelSize: 1.25,
  outdatedSources: [`https://hf.example/v0.9.0/${id}.pte`],
  ...overrides,
});

const updateOutdatedModels = jest.fn(() => Promise.resolve());

beforeEach(() => {
  updateOutdatedModels.mockClear();
  useModelStore.setState({
    models: [],
    downloadStates: {},
    retiredModels: [],
    updateOutdatedModels,
  });
});

describe('the model update notice in What’s new', () => {
  it('stays hidden when every downloaded model is on the current files', () => {
    useModelStore.setState({
      models: [
        model(1, { outdatedSources: undefined }),
        model(2, { isDownloaded: false }),
      ],
    });

    render(<ModelUpdateNotice />);

    expect(screen.queryByTestId('model-update-notice')).toBeNull();
  });

  it('says how many models and gigabytes the update downloads', () => {
    useModelStore.setState({
      models: [model(1), model(2), model(3, { outdatedSources: undefined })],
    });

    render(<ModelUpdateNotice />);

    expect(screen.getByText(MODEL_UPDATE_TEXT.body(2, 2.5))).toBeTruthy();
    expect(screen.getByText('Update 2 models')).toBeTruthy();
  });

  it('starts updating every outdated model from one tap', () => {
    useModelStore.setState({ models: [model(1)] });

    render(<ModelUpdateNotice />);
    fireEvent.press(screen.getByText('Update 1 model'));

    expect(updateOutdatedModels).toHaveBeenCalledTimes(1);
  });

  it('shows how many are left and takes no second tap while it updates', () => {
    useModelStore.setState({
      models: [model(1), model(2)],
      downloadStates: { 1: { progress: 0.4, status: ModelState.Downloading } },
    });

    render(<ModelUpdateNotice />);
    fireEvent.press(screen.getByText(MODEL_UPDATE_TEXT.inProgress(2)));

    expect(updateOutdatedModels).not.toHaveBeenCalled();
  });

  describe('after a model the catalog retired was removed', () => {
    const retiredModels = [
      {
        modelName: 'LLaMA 3.2 - 1B - QLoRa',
        replacement: 'LLaMA 3.2 - 1B - SpinQuant',
      },
    ];
    const spinQuant = model(8, {
      modelName: 'LLaMA 3.2 - 1B - SpinQuant',
      isDownloaded: false,
      outdatedSources: undefined,
      modelSize: 1.09,
    });

    it('says the model was removed and offers its replacement', () => {
      useModelStore.setState({ models: [spinQuant], retiredModels });

      render(<ModelUpdateNotice />);

      expect(
        screen.getByText(
          MODEL_UPDATE_TEXT.retired(
            'LLaMA 3.2 - 1B - QLoRa',
            'LLaMA 3.2 - 1B - SpinQuant'
          )
        )
      ).toBeTruthy();
      expect(screen.getByText(MODEL_UPDATE_TEXT.body(1, 1.09))).toBeTruthy();
      expect(screen.getByText('Update 1 model')).toBeTruthy();
    });

    it('shows the update as running while the replacement downloads', () => {
      useModelStore.setState({
        models: [spinQuant],
        retiredModels,
        downloadStates: {
          8: { status: ModelState.Downloading, progress: 0.3 },
        },
      });

      render(<ModelUpdateNotice />);

      expect(screen.getByText(MODEL_UPDATE_TEXT.inProgress(1))).toBeTruthy();
    });

    it('offers no download once the replacement is on the phone', () => {
      useModelStore.setState({
        models: [{ ...spinQuant, isDownloaded: true }],
        retiredModels,
      });

      render(<ModelUpdateNotice />);

      expect(screen.queryByText(MODEL_UPDATE_TEXT.title)).toBeNull();
      expect(screen.queryByText('Update 1 model')).toBeNull();
    });
  });
});
