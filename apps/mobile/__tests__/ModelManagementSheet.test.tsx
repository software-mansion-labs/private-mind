import React, { createRef } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../store/modelStore', () => ({
  useModelStore: jest.fn(() => ({
    removeModel: jest.fn(),
    removeModelFiles: jest.fn(),
  })),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// ModelCard — stub to show model name
jest.mock('../components/model-hub/ModelCard', () => {
  const { Text } = require('react-native');
  return ({ model }: any) => <Text testID="model-card">{model.modelName}</Text>;
});

// BottomSheetModal — immediately render children with injected data
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  let _injectedData: any = null;

  const BottomSheetModal = React.forwardRef((props: any, _ref: any) => {
    if (!props.children || !_injectedData) return null;
    return <View>{props.children({ data: _injectedData })}</View>;
  });
  // Attach a way for tests to set the data before rendering
  (BottomSheetModal as any).__setData = (d: any) => {
    _injectedData = d;
  };

  return {
    BottomSheetModal,
    BottomSheetView: ({ children, style }: any) => (
      <View style={style}>{children}</View>
    ),
    BottomSheetBackdrop: () => null,
  };
});

// ── imports ───────────────────────────────────────────────────────────────────

import ModelManagementSheet from '../components/bottomSheets/ModelManagementSheet';
import { useModelStore } from '../store/modelStore';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';

const mockUseModelStore = useModelStore as jest.Mock;
const setSheetData = (BottomSheetModal as any).__setData;

const baseModel = {
  id: 1,
  modelName: 'Test Model',
  source: 'remote' as const,
  isDownloaded: true,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  featured: false,
};

const renderSheet = (model = baseModel) => {
  setSheetData(model);
  return render(<ModelManagementSheet bottomSheetModalRef={createRef()} />);
};

beforeEach(() => {
  mockUseModelStore.mockReturnValue({
    removeModel: jest.fn(),
    removeModelFiles: jest.fn(),
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setSheetData(null);
  jest.restoreAllMocks();
});

// ─── Initial stage ────────────────────────────────────────────────────────────

describe('Initial stage', () => {
  it('renders the model card with model name', () => {
    renderSheet();
    expect(screen.getByTestId('model-card')).toBeTruthy();
    expect(screen.getByText('Test Model')).toBeTruthy();
  });

  it('shows "Edit model" for remote models', () => {
    renderSheet({ ...baseModel, source: 'remote' });
    expect(screen.getByText('Edit model')).toBeTruthy();
  });

  it('does not show "Edit model" for built-in models', () => {
    renderSheet({ ...baseModel, source: 'built-in' as any });
    expect(screen.queryByText('Edit model')).toBeNull();
  });

  it('shows "Delete downloaded files" for downloaded remote models', () => {
    renderSheet({ ...baseModel, source: 'remote', isDownloaded: true });
    expect(screen.getByText('Delete downloaded files')).toBeTruthy();
  });

  it('does not show "Delete downloaded files" for local models', () => {
    renderSheet({ ...baseModel, source: 'local' as any, isDownloaded: true });
    expect(screen.queryByText('Delete downloaded files')).toBeNull();
  });

  it('shows "Remove from the app" for non-built-in models', () => {
    renderSheet({ ...baseModel, source: 'remote' });
    expect(screen.getByText('Remove from the app')).toBeTruthy();
  });

  it('does not show "Remove from the app" for built-in models', () => {
    renderSheet({ ...baseModel, source: 'built-in' as any });
    expect(screen.queryByText('Remove from the app')).toBeNull();
  });
});

// ─── RemoveFiles stage ────────────────────────────────────────────────────────

describe('RemoveFiles stage', () => {
  it('transitions to RemoveFiles stage on "Delete downloaded files" press', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Delete downloaded files'));
    expect(
      screen.getByText(/Are you sure you want to delete files/)
    ).toBeTruthy();
  });

  it('shows "Delete model files" confirm button', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Delete downloaded files'));
    expect(screen.getByText('Delete model files')).toBeTruthy();
  });

  it('calls removeModelFiles and shows success toast on confirm', async () => {
    const removeModelFiles = jest.fn().mockResolvedValue(undefined);
    mockUseModelStore.mockReturnValue({
      removeModel: jest.fn(),
      removeModelFiles,
    });
    renderSheet();

    fireEvent.press(screen.getByText('Delete downloaded files'));
    fireEvent.press(screen.getByText('Delete model files'));

    await waitFor(() =>
      expect(removeModelFiles).toHaveBeenCalledWith(baseModel.id)
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: expect.stringContaining('Test Model') })
    );
  });

  it('returns to Initial stage on "Close" press', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Delete downloaded files'));
    fireEvent.press(screen.getByText('Close'));
    expect(screen.getByTestId('model-card')).toBeTruthy();
  });
});

// ─── RemoveModel stage ────────────────────────────────────────────────────────

describe('RemoveModel stage', () => {
  it('transitions to RemoveModel stage on "Remove from the app" press', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Remove from the app'));
    expect(screen.getByText(/permanently remove this model/)).toBeTruthy();
  });

  it('calls removeModel and shows success toast on confirm', async () => {
    const removeModel = jest.fn().mockResolvedValue(undefined);
    mockUseModelStore.mockReturnValue({
      removeModel,
      removeModelFiles: jest.fn(),
    });
    renderSheet();

    fireEvent.press(screen.getByText('Remove from the app'));
    // Second press targets the confirm button in the new stage
    fireEvent.press(screen.getByText('Remove from the app'));

    await waitFor(() => expect(removeModel).toHaveBeenCalledWith(baseModel.id));
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: expect.stringContaining('Test Model') })
    );
  });

  it('returns to Initial stage on "Close" press', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Remove from the app'));
    fireEvent.press(screen.getByText('Close'));
    expect(screen.getByTestId('model-card')).toBeTruthy();
  });
});
