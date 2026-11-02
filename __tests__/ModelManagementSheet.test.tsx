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

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    canDismiss: jest.fn(() => false),
    dismissAll: jest.fn(),
  },
}));

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));

jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: jest.fn(),
}));

const mockDeleteModelFiles = jest.fn();
jest.mock('../hooks/useDeleteModelFiles', () => ({
  useDeleteModelFiles: () => ({
    deleteModelFiles: mockDeleteModelFiles,
    ConfirmElement: null,
  }),
}));

const mockConfirm = jest.fn();
jest.mock('../hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: mockConfirm, ConfirmElement: null }),
}));

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
import { startPhantomChat } from '../utils/startPhantomChat';

const mockUseModelStore = useModelStore as unknown as jest.Mock;
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
  it('renders the model name in the header', () => {
    renderSheet();
    expect(screen.getByTestId('model-sheet-name')).toBeTruthy();
    expect(screen.getByText('Test Model')).toBeTruthy();
  });

  it('starts a chat with the model on "Start a chat" press', () => {
    renderSheet();
    fireEvent.press(screen.getByText('Start a chat'));
    expect(startPhantomChat).toHaveBeenCalledWith(
      expect.anything(),
      'replace',
      expect.objectContaining({ id: baseModel.id })
    );
  });

  it('does not offer "Start a chat" for models that are not downloaded', () => {
    renderSheet({ ...baseModel, isDownloaded: false });
    expect(screen.queryByText('Start a chat')).toBeNull();
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

// ─── Delete files ─────────────────────────────────────────────────────────────

describe('Delete downloaded files', () => {
  it('dismisses the sheet and hands off to the shared delete confirmation', () => {
    const ref = createRef<any>();
    const dismiss = jest.fn();
    setSheetData(baseModel);
    render(<ModelManagementSheet bottomSheetModalRef={ref} />);
    ref.current = { dismiss };

    fireEvent.press(screen.getByText('Delete downloaded files'));

    expect(dismiss).toHaveBeenCalled();
    expect(mockDeleteModelFiles).toHaveBeenCalledWith(baseModel);
  });
});

// ─── Remove from the app ──────────────────────────────────────────────────────

describe('Remove from the app', () => {
  it('removes the model and shows a toast once confirmed', async () => {
    const removeModel = jest.fn().mockResolvedValue(undefined);
    mockUseModelStore.mockReturnValue({ removeModel });
    mockConfirm.mockResolvedValue(true);
    renderSheet();

    fireEvent.press(screen.getByText('Remove from the app'));

    await waitFor(() => expect(removeModel).toHaveBeenCalledWith(baseModel.id));
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmLabel: 'Remove' })
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: expect.stringContaining('Test Model') })
    );
  });

  it('keeps the model when the confirmation is cancelled', async () => {
    const removeModel = jest.fn();
    mockUseModelStore.mockReturnValue({ removeModel });
    mockConfirm.mockResolvedValue(false);
    renderSheet();

    fireEvent.press(screen.getByText('Remove from the app'));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(removeModel).not.toHaveBeenCalled();
  });
});
