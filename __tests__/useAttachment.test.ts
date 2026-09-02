import { renderHook, act } from '@testing-library/react-native';

jest.mock('expo-media-library', () => ({
  getAssetInfoAsync: jest.fn(),
  usePermissions: jest.fn(() => [null, jest.fn()]),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
const mockCleanupOrphanedSources = jest.fn();
jest.mock('../store/sourceStore', () => ({
  useSourceStore: {
    getState: jest.fn(() => ({
      addSource: jest.fn(),
      cleanupOrphanedSources: mockCleanupOrphanedSources,
    })),
  },
}));
jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: {} })),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import { useAttachment } from '../hooks/useAttachment';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import { useLLMStore } from '../store/llmStore';
import { useVectorStore } from '../context/VectorStoreContext';

const mockGetAssetInfoAsync = MediaLibrary.getAssetInfoAsync as jest.Mock;
const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const mockUseVectorStore = useVectorStore as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseVectorStore.mockReturnValue({ vectorStore: {}, embeddings: null });
  useEmbeddingModelStore.setState({ status: 'ready', progress: 1 });
});

type HookResult = { current: ReturnType<typeof useAttachment> };

/** Hands the hook a photo the way the grid and the camera do. */
const attachPhoto = async (result: HookResult, uri: string, id = uri) => {
  await act(async () => {
    await result.current.addImages([{ id, uri }]);
  });
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

describe('useAttachment', () => {
  it('initializes with empty attachments', () => {
    const { result } = renderHook(() => useAttachment());
    expect(result.current.attachments).toEqual([]);
  });

  it('addImages attaches a picked photo', async () => {
    const { result } = renderHook(() => useAttachment());
    await attachPhoto(result, 'file://photo.jpg');
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].type).toBe('image');
    expect(result.current.attachments[0].uri).toBe('file://photo.jpg');
    expect(result.current.attachments[0].status).toBe('ready');
    // Nothing to resolve: Android and the camera already hand back a file.
    expect(mockGetAssetInfoAsync).not.toHaveBeenCalled();
  });

  it('resolves an iOS library asset to its local file', async () => {
    mockGetAssetInfoAsync.mockResolvedValue({
      localUri: 'file://resolved.heic',
    });
    const { result } = renderHook(() => useAttachment());
    await attachPhoto(result, 'ph://asset-1', 'asset-1');

    // Never over the network: the picker must not block on an iCloud fetch.
    expect(mockGetAssetInfoAsync).toHaveBeenCalledWith('asset-1', {
      shouldDownloadFromNetwork: false,
    });
    expect(result.current.attachments[0].uri).toBe('file://resolved.heic');
    expect(result.current.attachments[0].status).toBe('ready');
  });

  it('drops a photo that cannot be resolved to a file', async () => {
    mockGetAssetInfoAsync.mockResolvedValue({ localUri: null });
    const { result } = renderHook(() => useAttachment());
    await attachPhoto(result, 'ph://asset-2', 'asset-2');

    expect(result.current.attachments).toEqual([]);
  });

  it('adds nothing for an empty selection', async () => {
    const { result } = renderHook(() => useAttachment());
    await act(async () => {
      await result.current.addImages([]);
    });
    expect(result.current.attachments).toEqual([]);
  });

  it('keeps only the single image the send path can carry', async () => {
    const { result } = renderHook(() => useAttachment());
    await act(async () => {
      await result.current.addImages([
        { id: 'a', uri: 'file://a.jpg' },
        { id: 'b', uri: 'file://b.jpg' },
      ]);
    });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].id).toBe('a');
  });

  describe('embedding model download hand-off', () => {
    const realEnsureReady = useEmbeddingModelStore.getState().ensureReady;
    afterEach(() => {
      useEmbeddingModelStore.setState({ ensureReady: realEnsureReady });
    });

    const mountWithSheets = () => {
      const view = renderHook(() => useAttachment());
      const downloadSheet = { present: jest.fn(), dismiss: jest.fn() };
      act(() => {
        (
          view.result.current.embeddingDownloadSheetRef as { current: unknown }
        ).current = downloadSheet;
        view.result.current.markPanelOpen();
      });
      return { view, downloadSheet };
    };

    it('waits for the panel to collapse before showing the download sheet', async () => {
      useEmbeddingModelStore.setState({
        status: 'not_downloaded',
        progress: 0,
      });
      const { view, downloadSheet } = mountWithSheets();

      await act(async () => {
        await view.result.current.pickDocument();
      });

      // The panel is still collapsing; the download sheet waits it out.
      expect(downloadSheet.present).not.toHaveBeenCalled();

      act(() => {
        view.result.current.markPanelClosed();
      });

      expect(downloadSheet.present).toHaveBeenCalledTimes(1);
    });

    it('opens the document picker only once the download sheet is gone', async () => {
      useEmbeddingModelStore.setState({
        status: 'not_downloaded',
        progress: 0,
      });
      const ensureReady = jest.fn().mockResolvedValue(true);
      useEmbeddingModelStore.setState({ ensureReady });
      const getState = jest.spyOn(useLLMStore, 'getState').mockReturnValue({
        runWithModelOffloaded: (operation: () => Promise<unknown>) =>
          operation(),
      } as unknown as ReturnType<typeof useLLMStore.getState>);
      mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });

      const { view, downloadSheet } = mountWithSheets();
      await act(async () => {
        await view.result.current.pickDocument();
      });
      act(() => {
        view.result.current.markPanelClosed();
      });

      await act(async () => {
        await view.result.current.downloadModelAndContinue();
      });

      expect(ensureReady).toHaveBeenCalled();
      expect(downloadSheet.dismiss).toHaveBeenCalledTimes(1);
      expect(mockGetDocumentAsync).not.toHaveBeenCalled();

      await act(async () => {
        view.result.current.markDownloadSheetClosed();
      });

      expect(mockGetDocumentAsync).toHaveBeenCalledTimes(1);
      getState.mockRestore();
    });

    it('does not hijack the screen when the user closed the download sheet', async () => {
      useEmbeddingModelStore.setState({
        status: 'not_downloaded',
        progress: 0,
      });
      useEmbeddingModelStore.setState({
        ensureReady: jest.fn().mockResolvedValue(true),
      });
      const getState = jest.spyOn(useLLMStore, 'getState').mockReturnValue({
        runWithModelOffloaded: (operation: () => Promise<unknown>) =>
          operation(),
      } as unknown as ReturnType<typeof useLLMStore.getState>);

      const { view, downloadSheet } = mountWithSheets();
      await act(async () => {
        await view.result.current.pickDocument();
      });
      act(() => {
        view.result.current.markPanelClosed();
        view.result.current.markDownloadSheetClosed();
      });

      await act(async () => {
        await view.result.current.downloadModelAndContinue();
      });

      expect(downloadSheet.dismiss).not.toHaveBeenCalled();
      expect(mockGetDocumentAsync).not.toHaveBeenCalled();
      getState.mockRestore();
    });
  });

  it('pickDocument processes document through RAG and stores sourceId', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
    });

    const mockAddSource = jest
      .fn()
      .mockResolvedValue({ success: true, sourceId: 42 });
    const runWithLoadedModel = jest.fn(
      async (operation: () => Promise<unknown>) => operation()
    );
    mockUseVectorStore.mockReturnValue({
      vectorStore: {},
      embeddings: { runWithLoadedModel },
    });
    const { useSourceStore } = require('../store/sourceStore');
    useSourceStore.getState.mockReturnValue({
      addSource: mockAddSource,
      cleanupOrphanedSources: mockCleanupOrphanedSources,
    });

    const { result } = renderHook(() => useAttachment());
    await act(async () => {
      await result.current.pickDocument();
    });

    expect(result.current.attachments).toHaveLength(1);
    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.sourceId).toBe(42);
    expect(att.status).toBe('ready');
    expect(runWithLoadedModel).toHaveBeenCalledTimes(1);
  });

  describe('abandoned source cleanup', () => {
    const pickReadyDocument = async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
      });
      const { useSourceStore } = require('../store/sourceStore');
      useSourceStore.getState.mockReturnValue({
        addSource: jest.fn().mockResolvedValue({ success: true, sourceId: 42 }),
        cleanupOrphanedSources: mockCleanupOrphanedSources,
      });

      const view = renderHook(() => useAttachment());
      await act(async () => {
        await view.result.current.pickDocument();
      });
      mockCleanupOrphanedSources.mockClear();
      return view;
    };

    it('sweeps when an embedded document is removed before it is ever sent', async () => {
      const { result } = await pickReadyDocument();

      act(() => {
        result.current.removeAttachment(result.current.attachments[0].id);
      });

      expect(mockCleanupOrphanedSources).toHaveBeenCalledTimes(1);
    });

    it('sweeps when the screen unmounts with the document still attached', async () => {
      const { unmount } = await pickReadyDocument();

      unmount();

      expect(mockCleanupOrphanedSources).toHaveBeenCalledTimes(1);
    });

    it('does not sweep on send, when the source is about to be linked to the chat', async () => {
      const { result } = await pickReadyDocument();

      act(() => {
        result.current.clearAll({ cleanupSources: false });
      });

      expect(mockCleanupOrphanedSources).not.toHaveBeenCalled();
    });

    it('does not sweep when a plain image is removed', async () => {
      const { result } = renderHook(() => useAttachment());
      await attachPhoto(result, 'file://photo.jpg');
      mockCleanupOrphanedSources.mockClear();

      act(() => {
        result.current.removeAttachment(result.current.attachments[0].id);
      });

      expect(mockCleanupOrphanedSources).not.toHaveBeenCalled();
    });
  });

  it('ignores a stale document result when a second document replaces it', async () => {
    const firstSource = createDeferred<{
      success: boolean;
      sourceId: number;
    }>();
    const secondSource = createDeferred<{
      success: boolean;
      sourceId: number;
    }>();
    const mockAddSource = jest
      .fn()
      .mockReturnValueOnce(firstSource.promise)
      .mockReturnValueOnce(secondSource.promise);
    const { useSourceStore } = require('../store/sourceStore');
    useSourceStore.getState.mockReturnValue({
      addSource: mockAddSource,
      cleanupOrphanedSources: mockCleanupOrphanedSources,
    });
    mockGetDocumentAsync
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://first.pdf', name: 'first.pdf', size: 100 }],
      })
      .mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://second.pdf', name: 'second.pdf', size: 100 }],
      });
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useAttachment());
    let firstPick!: Promise<void>;
    let secondPick!: Promise<void>;

    await act(async () => {
      firstPick = result.current.pickDocument();
    });
    await act(async () => {
      secondPick = result.current.pickDocument();
    });
    await act(async () => {
      secondSource.resolve({ success: true, sourceId: 2 });
      await secondPick;
    });
    await act(async () => {
      firstSource.resolve({ success: true, sourceId: 1 });
      await firstPick;
    });

    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].name).toBe('second.pdf');
    expect(result.current.attachments[0].sourceId).toBe(2);
  });

  it('removeAttachment removes by id', async () => {
    const { result } = renderHook(() => useAttachment());
    await attachPhoto(result, 'file://photo.jpg');
    const id = result.current.attachments[0].id;
    act(() => {
      result.current.removeAttachment(id);
    });
    expect(result.current.attachments).toEqual([]);
  });

  it('clearAll removes all attachments', async () => {
    const { result } = renderHook(() => useAttachment());
    await attachPhoto(result, 'file://photo.jpg');
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.attachments).toEqual([]);
  });

  describe('single-attachment replacement', () => {
    it('a second photo replaces the first', async () => {
      const { result } = renderHook(() => useAttachment());
      await attachPhoto(result, 'file://first.jpg');
      await attachPhoto(result, 'file://second.jpg');

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].uri).toBe('file://second.jpg');
    });

    it('a camera capture replaces a picked photo', async () => {
      const { result } = renderHook(() => useAttachment());
      await attachPhoto(result, 'file://picked.jpg');
      await attachPhoto(result, 'file://camera.jpg');

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].uri).toBe('file://camera.jpg');
    });

    it('pickDocument replaces an existing image', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
      });
      const mockAddSource = jest
        .fn()
        .mockResolvedValue({ success: true, sourceId: 7 });
      const { useSourceStore } = require('../store/sourceStore');
      useSourceStore.getState.mockReturnValue({
        addSource: mockAddSource,
        cleanupOrphanedSources: mockCleanupOrphanedSources,
      });

      const { result } = renderHook(() => useAttachment());
      await attachPhoto(result, 'file://photo.jpg');
      await act(async () => {
        await result.current.pickDocument();
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('document');
    });

    it('picking an image after a document does not clean up sources during attachment replacement', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
      });
      const mockAddSource = jest
        .fn()
        .mockResolvedValue({ success: true, sourceId: 99 });
      const mockCleanup = jest.fn();
      const { useSourceStore } = require('../store/sourceStore');
      useSourceStore.getState.mockImplementation(() => ({
        addSource: mockAddSource,
        cleanupOrphanedSources: mockCleanup,
      }));

      const { result } = renderHook(() => useAttachment());
      await act(async () => {
        await result.current.pickDocument();
      });
      expect(result.current.attachments[0].sourceId).toBe(99);

      await attachPhoto(result, 'file://photo.jpg');

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('image');
      expect(mockCleanup).not.toHaveBeenCalled();
    });

    it('addPastedAttachment replaces an existing image', () => {
      const { result } = renderHook(() => useAttachment());
      act(() => {
        result.current.addPastedAttachment('file://first.jpg');
      });
      act(() => {
        result.current.addPastedAttachment('file://second.jpg');
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].uri).toBe('file://second.jpg');
    });
  });

  describe('addPastedAttachment', () => {
    it('adds pasted image attachment for valid image URI', () => {
      const { result } = renderHook(() => useAttachment());
      act(() => {
        result.current.addPastedAttachment('file://pasted-image.jpg');
      });
      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('image');
      expect(result.current.attachments[0].uri).toBe('file://pasted-image.jpg');
      expect(result.current.attachments[0].status).toBe('ready');
    });

    it('supports multiple image formats', () => {
      const { result } = renderHook(() => useAttachment());
      const formats = [
        'file://image.jpg',
        'file://image.jpeg',
        'file://image.png',
        'file://image.gif',
        'file://image.webp',
        'file://image.heic',
      ];

      formats.forEach((uri) => {
        act(() => {
          result.current.addPastedAttachment(uri);
        });
        expect(result.current.attachments).toHaveLength(1);
        expect(result.current.attachments[0].type).toBe('image');
        expect(result.current.attachments[0].uri).toBe(uri);
        expect(result.current.attachments[0].status).toBe('ready');
      });
    });

    it('shows toast and does not add attachment for non-image URI', () => {
      const Toast = require('react-native-toast-message');
      const { result } = renderHook(() => useAttachment());

      act(() => {
        result.current.addPastedAttachment('file://document.pdf');
      });

      expect(result.current.attachments).toHaveLength(0);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text1: expect.stringContaining('Only images can be pasted'),
        })
      );
    });

    it('handles empty URI gracefully', () => {
      const { result } = renderHook(() => useAttachment());
      act(() => {
        result.current.addPastedAttachment('');
      });
      expect(result.current.attachments).toHaveLength(0);
    });

    it('handles invalid URI type gracefully', () => {
      const { result } = renderHook(() => useAttachment());
      act(() => {
        // @ts-expect-error testing invalid input
        result.current.addPastedAttachment(null);
      });
      expect(result.current.attachments).toHaveLength(0);
    });

    it('generates IDs for pasted attachments', () => {
      const { result } = renderHook(() => useAttachment());

      act(() => {
        result.current.addPastedAttachment('file://image1.jpg');
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].id).toMatch(/^img-\d+$/);
    });
  });
});
