import { act, renderHook, waitFor } from '@testing-library/react-native';
import useChatBranching from '../hooks/useChatBranching';
import * as chatRepository from '../database/chatRepository';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { CHAT_ENTRY_ANIMATION } from '../constants/chat-route-params';
import Toast from 'react-native-toast-message';

jest.mock('../database/chatRepository');

jest.mock('expo-sqlite', () => {
  const stableDb = {};
  return { useSQLiteContext: jest.fn(() => stableDb) };
});

jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(),
}));

jest.mock('../store/llmStore', () => ({
  useLLMStore: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const mockRouter = jest.requireMock('expo-router').router as {
  push: jest.Mock;
};

const mockUseChatStore = useChatStore as unknown as jest.Mock;
const mockUseLLMStore = useLLMStore as unknown as jest.Mock;
const mockCheckIfChatExists = chatRepository.checkIfChatExists as jest.Mock;
const mockGetChatBranchMarkers =
  chatRepository.getChatBranchMarkers as jest.Mock;

const mockForkChat = jest.fn();
const mockGetChatById = jest.fn();
const mockSetActiveChatId = jest.fn();

const assistantMessage: chatRepository.Message = {
  id: 10,
  chatId: 1,
  role: 'assistant',
  content: 'Answer',
  timestamp: 123,
};

const branchMarker: chatRepository.ChatBranchMarker = {
  id: 1,
  chatId: 1,
  afterMessageId: 10,
  sourceChatId: 4,
  sourceMessageId: 8,
  sourceChatTitle: 'Original chat',
  sourceMessagePreview: 'Answer',
  createdAt: 123,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});

  mockUseChatStore.mockReturnValue({
    phantomChat: null,
    forkChat: mockForkChat,
    getChatById: mockGetChatById,
  });
  mockUseLLMStore.mockReturnValue({
    setActiveChatId: mockSetActiveChatId,
  });
  mockCheckIfChatExists.mockResolvedValue(true);
  mockGetChatBranchMarkers.mockResolvedValue([branchMarker]);
  mockForkChat.mockResolvedValue(99);
  mockGetChatById.mockReturnValue({ id: 4, title: 'Original chat' });
  mockSetActiveChatId.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('loads branch markers for a persisted chat', async () => {
  const { result } = renderHook(() =>
    useChatBranching({ chatId: 1, messageHistoryLength: 2 })
  );

  await waitFor(() =>
    expect(result.current.branchMarkers).toEqual([branchMarker])
  );
  expect(mockGetChatBranchMarkers).toHaveBeenCalledWith(expect.any(Object), 1);
});

it('does not load branch markers for an unpersisted phantom chat', async () => {
  mockUseChatStore.mockReturnValue({
    phantomChat: { id: 1 },
    forkChat: mockForkChat,
    getChatById: mockGetChatById,
  });
  mockCheckIfChatExists.mockResolvedValue(false);

  const { result } = renderHook(() =>
    useChatBranching({ chatId: 1, messageHistoryLength: 0 })
  );

  await waitFor(() => expect(result.current.branchMarkers).toEqual([]));
  expect(mockGetChatBranchMarkers).not.toHaveBeenCalled();
});

it('forks an assistant message and navigates to the new branch', async () => {
  const { result } = renderHook(() =>
    useChatBranching({ chatId: 1, messageHistoryLength: 2 })
  );

  await act(async () => {
    await result.current.handleForkMessage(assistantMessage);
  });

  expect(mockForkChat).toHaveBeenCalledWith(1, 10);
  expect(mockSetActiveChatId).toHaveBeenCalledWith(99);
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: '/chat/99',
    params: {
      entryAnimation: CHAT_ENTRY_ANIMATION.BranchCreated,
    },
  });
});

it('blocks forking an unpersisted phantom chat', async () => {
  mockUseChatStore.mockReturnValue({
    phantomChat: { id: 1 },
    forkChat: mockForkChat,
    getChatById: mockGetChatById,
  });
  mockCheckIfChatExists.mockResolvedValue(false);

  const { result } = renderHook(() =>
    useChatBranching({ chatId: 1, messageHistoryLength: 1 })
  );

  await act(async () => {
    await result.current.handleForkMessage(assistantMessage);
  });

  expect(mockForkChat).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith({
    type: 'defaultToast',
    text1: 'Send a message before branching this chat.',
  });
});

it('opens the source chat when a branch marker is pressed', async () => {
  const { result } = renderHook(() =>
    useChatBranching({ chatId: 1, messageHistoryLength: 2 })
  );

  await act(async () => {
    await result.current.handleBranchMarkerPress(branchMarker);
  });

  expect(mockSetActiveChatId).toHaveBeenCalledWith(4);
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/4' });
});
