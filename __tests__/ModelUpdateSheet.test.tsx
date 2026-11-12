import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ModelUpdateSheet from '../components/bottomSheets/ModelUpdateSheet';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';
import { useModelStore } from '../store/modelStore';
import { useModelUpdateSheetStore } from '../store/modelUpdateSheetStore';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('../components/bottomSheets/BackDismissibleSheetModal', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return {
    __esModule: true,
    default: forwardRef(
      ({ children }: { children: React.ReactNode }, ref: unknown) => {
        useImperativeHandle(ref, () => ({
          present: mockPresent,
          dismiss: mockDismiss,
        }));
        return children;
      }
    ),
  };
});

jest.mock('../hooks/useUpdateNetworkCheck', () => ({
  useUpdateNetworkCheck: () => ({
    canDownload: () => Promise.resolve('wifi'),
    ConfirmElement: null,
  }),
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

const qwen: Model = {
  id: 1,
  modelName: 'Qwen 2.5 - 0.5B',
  source: 'built-in',
  isDownloaded: true,
  modelPath: 'https://hf.example/v0.11.0/qwen.pte',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  modelSize: 0.44,
  outdatedSources: ['https://hf.example/v0.9.0/qwen.pte'],
  updateRequired: true,
};

const updateOutdatedModels = jest.fn(() => Promise.resolve());
const resumeConsentedUpdates = jest.fn(() => Promise.resolve(false));

const enterNewChat = async () => {
  await act(async () => {
    useModelUpdateSheetStore.getState().enterNewChat();
  });
};

beforeEach(() => {
  mockPresent.mockClear();
  mockDismiss.mockClear();
  updateOutdatedModels.mockClear();
  resumeConsentedUpdates.mockClear();
  resumeConsentedUpdates.mockResolvedValue(false);
  useModelUpdateSheetStore.setState({ newChatEntries: 0 });
  useModelStore.setState({
    models: [qwen],
    retiredModels: [],
    updateConsent: { modelNames: [], overMobileData: false },
    updateOutdatedModels,
    resumeConsentedUpdates,
  });
});

describe('the model update sheet on a new chat', () => {
  it('opens when a new chat starts while a model needs its update', async () => {
    render(<ModelUpdateSheet />);
    await enterNewChat();

    expect(mockPresent).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(MODEL_UPDATE_TEXT.body(1, qwen.modelSize!))
    ).toBeTruthy();
  });

  it('stays closed when the only update is a newer export of a working model', async () => {
    useModelStore.setState({ models: [{ ...qwen, updateRequired: false }] });
    render(<ModelUpdateSheet />);
    await enterNewChat();

    expect(mockPresent).not.toHaveBeenCalled();
  });

  it('opens again on the next new chat after Not now', async () => {
    render(<ModelUpdateSheet />);
    await enterNewChat();
    fireEvent.press(screen.getByText(MODEL_UPDATE_TEXT.later));
    await enterNewChat();

    expect(mockPresent).toHaveBeenCalledTimes(2);
  });

  it('starts the update and stops asking after the first tap on Update', async () => {
    render(<ModelUpdateSheet />);
    await enterNewChat();
    await act(async () => {
      fireEvent.press(screen.getByText(MODEL_UPDATE_TEXT.action(1)));
    });
    await enterNewChat();

    expect(updateOutdatedModels).toHaveBeenCalledWith([qwen]);
    expect(useModelStore.getState().updateConsent.modelNames).toEqual([
      qwen.modelName,
    ]);
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });

  it('stays closed at launch when an agreed update resumes by itself', async () => {
    resumeConsentedUpdates.mockResolvedValue(true);
    useModelStore.setState({
      updateConsent: { modelNames: [qwen.modelName], overMobileData: false },
    });
    render(<ModelUpdateSheet />);
    await enterNewChat();

    expect(resumeConsentedUpdates).toHaveBeenCalledTimes(1);
    expect(mockPresent).not.toHaveBeenCalled();
  });
});
