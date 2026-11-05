import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ModelUpdatePrompt from '../components/ModelUpdatePrompt';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';
import { ModelState, useModelStore } from '../store/modelStore';

jest.mock('../hooks/useUpdateNetworkCheck', () => ({
  useUpdateNetworkCheck: () => ({
    canDownload: () => Promise.resolve(true),
    ConfirmElement: null,
  }),
}));

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
  modelSize: 0.5,
  outdatedSources: [`https://hf.example/v0.9.0/${id}.pte`],
  ...overrides,
});

const current = (id: number) => model(id, { outdatedSources: undefined });

const updateOutdatedModels = jest.fn(() => Promise.resolve());

const renderPrompt = () =>
  render(
    <ModelUpdatePrompt>
      <Text>the app</Text>
    </ModelUpdatePrompt>
  );

beforeEach(() => {
  updateOutdatedModels.mockReset().mockResolvedValue(undefined);
  useModelStore.setState({
    models: [],
    downloadStates: {},
    retiredModels: [],
    updateOutdatedModels,
  });
});

describe('the model update prompt at launch', () => {
  it('lets the app through when no downloaded model needs new files', () => {
    useModelStore.setState({ models: [current(1)] });

    renderPrompt();

    expect(screen.getByText('the app')).toBeTruthy();
    expect(screen.queryByTestId('model-update-prompt')).toBeNull();
  });

  it('holds the app behind the update while a downloaded model needs new files', () => {
    useModelStore.setState({ models: [model(1), model(2), current(3)] });

    renderPrompt();

    expect(screen.queryByText('the app')).toBeNull();
    expect(screen.getByText(MODEL_UPDATE_TEXT.body(2, 1))).toBeTruthy();
    expect(screen.getByText('Update 2 models')).toBeTruthy();
  });

  it('counts the successor of a removed model and says what was removed', () => {
    useModelStore.setState({
      models: [model(8, { isDownloaded: false, outdatedSources: undefined })],
      retiredModels: [{ modelName: 'Old', replacement: 'Model 8' }],
    });

    renderPrompt();

    expect(
      screen.getByText(MODEL_UPDATE_TEXT.retired('Old', 'Model 8'))
    ).toBeTruthy();
    expect(screen.getByText('Update 1 model')).toBeTruthy();
  });

  it('keeps the button disabled while a model downloads', () => {
    useModelStore.setState({
      models: [model(1)],
      downloadStates: { 1: { status: ModelState.Downloading, progress: 0.4 } },
    });

    renderPrompt();

    expect(screen.getByText(MODEL_UPDATE_TEXT.inProgress(1))).toBeTruthy();
    expect(screen.getByText('0.50 GB · 40%')).toBeTruthy();
  });

  it('asks to try again when the update ends with models still outdated', async () => {
    useModelStore.setState({ models: [model(1)] });
    renderPrompt();

    await act(async () => {
      fireEvent.press(screen.getByText('Update 1 model'));
    });

    expect(updateOutdatedModels).toHaveBeenCalled();
    expect(screen.getByText(MODEL_UPDATE_TEXT.failed)).toBeTruthy();
  });

  it('opens the app once every model is updated', () => {
    useModelStore.setState({ models: [model(1)] });
    renderPrompt();

    act(() => {
      useModelStore.setState({ models: [current(1)] });
    });

    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('does not take the app away when a model becomes outdated mid-session', () => {
    useModelStore.setState({ models: [current(1)] });
    renderPrompt();

    act(() => {
      useModelStore.setState({ models: [model(1)] });
    });

    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('lets the user into the app with Not now', () => {
    useModelStore.setState({ models: [model(1)] });
    renderPrompt();

    fireEvent.press(screen.getByText(MODEL_UPDATE_TEXT.later));

    expect(screen.getByText('the app')).toBeTruthy();
  });
});
