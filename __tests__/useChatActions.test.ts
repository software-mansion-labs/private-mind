import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

const mockDb = {};
jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => mockDb),
}));

const mockRenameChat = jest.fn();
const mockDeleteChat = jest.fn();
jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(() => ({
    renameChat: mockRenameChat,
    deleteChat: mockDeleteChat,
  })),
}));

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: null })),
}));

const mockExportChatRoom = jest.fn();
jest.mock('../database/exportImportRepository', () => ({
  exportChatRoom: (...args: any[]) => mockExportChatRoom(...args),
}));

import { useChatActions } from '../hooks/useChatActions';
import { useVectorStore } from '../context/VectorStoreContext';

const mockUseVectorStore = useVectorStore as jest.Mock;

const getDeleteButton = (alertSpy: jest.SpyInstance) => {
  const buttons = alertSpy.mock.calls[0][2] as any[];
  return buttons.find((button) => button.text === 'Delete');
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRenameChat.mockResolvedValue(undefined);
  mockDeleteChat.mockResolvedValue(undefined);
  mockExportChatRoom.mockResolvedValue(undefined);
  mockUseVectorStore.mockReturnValue({ vectorStore: null });
});

afterEach(() => jest.restoreAllMocks());

describe('rename', () => {
  it('renames the chat and shows a toast', async () => {
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.rename(42, 'New title');
    });

    expect(mockRenameChat).toHaveBeenCalledWith(42, 'New title');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Chat renamed' })
    );
  });

  it('clips titles longer than 25 characters', async () => {
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.rename(42, 'a'.repeat(30));
    });

    expect(mockRenameChat).toHaveBeenCalledWith(42, 'a'.repeat(25) + '...');
  });

  it('keeps a title of exactly 25 characters intact', async () => {
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.rename(42, 'a'.repeat(25));
    });

    expect(mockRenameChat).toHaveBeenCalledWith(42, 'a'.repeat(25));
  });

  it('alerts and skips the toast when renaming fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockRenameChat.mockRejectedValue(new Error('db down'));
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.rename(42, 'New title');
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', expect.any(String));
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe('exportChat', () => {
  it('exports the chat with the database handle, id and title', async () => {
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.exportChat(42, 'My Chat');
    });

    expect(mockExportChatRoom).toHaveBeenCalledWith(mockDb, 42, 'My Chat');
  });

  it('alerts when exporting fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockExportChatRoom.mockRejectedValue(new Error('no disk space'));
    const { result } = renderHook(() => useChatActions());

    await act(async () => {
      await result.current.exportChat(42, 'My Chat');
    });

    expect(alertSpy).toHaveBeenCalledWith('Error', expect.any(String));
  });
});

describe('confirmDelete', () => {
  it('asks for confirmation before deleting anything', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useChatActions());

    act(() => {
      result.current.confirmDelete(42);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Chat',
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    );
    expect(mockDeleteChat).not.toHaveBeenCalled();
  });

  it('deletes the chat and notifies the caller once confirmed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onDeleted = jest.fn();
    const { result } = renderHook(() => useChatActions({ onDeleted }));

    act(() => {
      result.current.confirmDelete(42);
    });

    await act(async () => {
      await getDeleteButton(alertSpy).onPress();
    });

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith(42, undefined);
    });
    expect(onDeleted).toHaveBeenCalledWith(42);
  });

  it('passes the vector store to deleteChat when one is available', async () => {
    const vectorStore = { id: 'vs' };
    mockUseVectorStore.mockReturnValue({ vectorStore });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useChatActions());

    act(() => {
      result.current.confirmDelete(42);
    });

    await act(async () => {
      await getDeleteButton(alertSpy).onPress();
    });

    expect(mockDeleteChat).toHaveBeenCalledWith(42, vectorStore);
  });

  it('alerts and does not notify the caller when deleting fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockDeleteChat.mockRejectedValue(new Error('db down'));
    const onDeleted = jest.fn();
    const { result } = renderHook(() => useChatActions({ onDeleted }));

    act(() => {
      result.current.confirmDelete(42);
    });

    await act(async () => {
      await getDeleteButton(alertSpy).onPress();
    });

    expect(onDeleted).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenLastCalledWith('Error', expect.any(String));
  });
});
