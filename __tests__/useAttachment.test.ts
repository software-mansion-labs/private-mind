import { renderHook, act } from '@testing-library/react-native';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('../store/sourceStore', () => ({
  useSourceStore: {
    getState: jest.fn(() => ({
      addSource: jest.fn(),
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

import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAttachment } from '../hooks/useAttachment';

const mockLaunchImageLibrary = launchImageLibrary as jest.Mock;
const mockLaunchCamera = launchCamera as jest.Mock;
const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('useAttachment', () => {
  it('initializes with empty attachments', () => {
    const { result } = renderHook(() => useAttachment());
    expect(result.current.attachments).toEqual([]);
  });

  it('pickFromLibrary adds an image attachment', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].type).toBe('image');
    expect(result.current.attachments[0].uri).toBe('file://photo.jpg');
    expect(result.current.attachments[0].status).toBe('ready');
  });

  it('pickFromCamera adds an image attachment', async () => {
    mockLaunchCamera.mockResolvedValue({
      assets: [{ uri: 'file://camera.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromCamera(); });
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0].type).toBe('image');
  });

  it('does not add attachment when image picker is cancelled', async () => {
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    expect(result.current.attachments).toEqual([]);
  });

  it('pickDocument processes document through RAG and stores sourceId', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
    });

    const mockAddSource = jest.fn().mockResolvedValue({ success: true, sourceId: 42 });
    const { useSourceStore } = require('../store/sourceStore');
    useSourceStore.getState.mockReturnValue({ addSource: mockAddSource });

    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickDocument(); });

    expect(result.current.attachments).toHaveLength(1);
    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.sourceId).toBe(42);
    expect(att.status).toBe('ready');
  });

  it('removeAttachment removes by id', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    const id = result.current.attachments[0].id;
    act(() => { result.current.removeAttachment(id); });
    expect(result.current.attachments).toEqual([]);
  });

  it('clearAll removes all attachments', async () => {
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file://photo.jpg' }],
    });
    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickFromLibrary(); });
    act(() => { result.current.clearAll(); });
    expect(result.current.attachments).toEqual([]);
  });

  describe('single-attachment replacement', () => {
    it('pickFromLibrary replaces an existing image', async () => {
      mockLaunchImageLibrary
        .mockResolvedValueOnce({ assets: [{ uri: 'file://first.jpg' }] })
        .mockResolvedValueOnce({ assets: [{ uri: 'file://second.jpg' }] });

      const { result } = renderHook(() => useAttachment());
      await act(async () => { await result.current.pickFromLibrary(); });
      await act(async () => { await result.current.pickFromLibrary(); });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].uri).toBe('file://second.jpg');
    });

    it('pickFromCamera replaces an existing image', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        assets: [{ uri: 'file://pasted.jpg' }],
      });
      mockLaunchCamera.mockResolvedValue({
        assets: [{ uri: 'file://camera.jpg' }],
      });

      const { result } = renderHook(() => useAttachment());
      await act(async () => { await result.current.pickFromLibrary(); });
      await act(async () => { await result.current.pickFromCamera(); });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].uri).toBe('file://camera.jpg');
    });

    it('pickDocument replaces an existing image', async () => {
      mockLaunchImageLibrary.mockResolvedValue({
        assets: [{ uri: 'file://photo.jpg' }],
      });
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
      });
      const mockAddSource = jest.fn().mockResolvedValue({ success: true, sourceId: 7 });
      const { useSourceStore } = require('../store/sourceStore');
      useSourceStore.getState.mockReturnValue({ addSource: mockAddSource });

      const { result } = renderHook(() => useAttachment());
      await act(async () => { await result.current.pickFromLibrary(); });
      await act(async () => { await result.current.pickDocument(); });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('document');
    });

    it('picking an image after a document cleans up the orphaned source', async () => {
      mockGetDocumentAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
      });
      mockLaunchImageLibrary.mockResolvedValue({
        assets: [{ uri: 'file://photo.jpg' }],
      });
      const mockAddSource = jest.fn().mockResolvedValue({ success: true, sourceId: 99 });
      const mockCleanup = jest.fn();
      const { useSourceStore } = require('../store/sourceStore');
      useSourceStore.getState.mockImplementation(() => ({
        addSource: mockAddSource,
        cleanupOrphanedSources: mockCleanup,
      }));

      const { result } = renderHook(() => useAttachment());
      await act(async () => { await result.current.pickDocument(); });
      expect(result.current.attachments[0].sourceId).toBe(99);

      await act(async () => { await result.current.pickFromLibrary(); });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].type).toBe('image');
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('addPastedAttachment replaces an existing image', () => {
      const { result } = renderHook(() => useAttachment());
      act(() => { result.current.addPastedAttachment('file://first.jpg'); });
      act(() => { result.current.addPastedAttachment('file://second.jpg'); });

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

      formats.forEach(uri => {
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
