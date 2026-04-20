import { renderHook, waitFor } from '@testing-library/react-native';
import useChatSettings from '../hooks/useChatSettings';
import * as chatRepository from '../database/chatRepository';
import { useChatStore } from '../store/chatStore';

jest.mock('../database/chatRepository');
jest.mock('expo-sqlite', () => {
  // Stable db object — must NOT be recreated on each call or useEffect re-fires infinitely
  const stableDb = {};
  return { useSQLiteContext: jest.fn(() => stableDb) };
});
jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(),
}));

const mockGetChatSettings = chatRepository.getChatSettings as jest.Mock;
const mockUseChatStore = useChatStore as jest.Mock;

const baseChat = {
  id: 1,
  title: 'Test Chat',
  modelId: 1,
  createdAt: '',
  lastUsedAt: '',
  enabledSources: [],
};

// Stable function references — must not be recreated per render or useMemo loops infinitely
const stableGetChatById = jest.fn(() => baseChat);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  stableGetChatById.mockReturnValue(baseChat);
  mockUseChatStore.mockReturnValue({
    getChatById: stableGetChatById,
    phantomChat: null,
  });
  mockGetChatSettings.mockResolvedValue({
    systemPrompt: 'You are helpful.',
    thinkingEnabled: false,
  });
});

afterEach(() => jest.restoreAllMocks());

// ─── initial load ─────────────────────────────────────────────────────────────

describe('initial load', () => {
  it('loads settings from DB on mount', async () => {
    const { result } = renderHook(() => useChatSettings(1));

    await waitFor(() =>
      expect(result.current.settings.systemPrompt).toBe('You are helpful.')
    );
    expect(result.current.settings.thinkingEnabled).toBe(false);
  });

  it('loads settings from phantom chat when chatId matches phantom', async () => {
    const phantomChat = {
      ...baseChat,
      id: 99,
      settings: { systemPrompt: 'Phantom prompt', thinkingEnabled: true },
    };
    mockUseChatStore.mockReturnValue({
      getChatById: stableGetChatById,
      phantomChat,
    });

    const { result } = renderHook(() => useChatSettings(99));

    await waitFor(() =>
      expect(result.current.settings.systemPrompt).toBe('Phantom prompt')
    );
    expect(result.current.settings.thinkingEnabled).toBe(true);
    expect(mockGetChatSettings).not.toHaveBeenCalled();
  });

  it('defaults thinkingEnabled to false when not in DB result', async () => {
    mockGetChatSettings.mockResolvedValue({
      systemPrompt: '',
    });
    const { result } = renderHook(() => useChatSettings(1));
    await waitFor(() => expect(result.current.settings.thinkingEnabled).toBe(false));
  });
});

// ─── setSetting ───────────────────────────────────────────────────────────────

describe('setSetting', () => {
  it('updates a single setting without affecting others', async () => {
    const { result } = renderHook(() => useChatSettings(1));
    await waitFor(() => expect(result.current.settings.systemPrompt).toBe('You are helpful.'));

    result.current.setSetting('systemPrompt', 'Be concise.');

    await waitFor(() => expect(result.current.settings.systemPrompt).toBe('Be concise.'));
    expect(result.current.settings.thinkingEnabled).toBe(false);
  });

  it('can set boolean values for thinkingEnabled', async () => {
    const { result } = renderHook(() => useChatSettings(1));
    await waitFor(() => expect(result.current.settings.thinkingEnabled).toBe(false));

    result.current.setSetting('thinkingEnabled', true);
    await waitFor(() => expect(result.current.settings.thinkingEnabled).toBe(true));
  });
});

// ─── chat reference ───────────────────────────────────────────────────────────

describe('chat reference', () => {
  it('returns the chat object from store', async () => {
    const { result } = renderHook(() => useChatSettings(1));
    await waitFor(() => expect(result.current.chat).toBeDefined());
    expect(result.current.chat?.title).toBe('Test Chat');
  });

  it('returns phantom chat when chatId matches', async () => {
    const phantomChat = { ...baseChat, id: 99, settings: { systemPrompt: '', thinkingEnabled: false } };
    mockUseChatStore.mockReturnValue({ getChatById: stableGetChatById, phantomChat });

    const { result } = renderHook(() => useChatSettings(99));
    await waitFor(() => expect(result.current.chat?.id).toBe(99));
  });
});
