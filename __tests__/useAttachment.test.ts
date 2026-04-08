import { renderHook, act } from '@testing-library/react-native';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('../utils/fileReaders', () => ({
  readDocumentText: jest.fn(),
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
import { readDocumentText } from '../utils/fileReaders';
import { useAttachment } from '../hooks/useAttachment';

const mockLaunchImageLibrary = launchImageLibrary as jest.Mock;
const mockLaunchCamera = launchCamera as jest.Mock;
const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const mockReadDocumentText = readDocumentText as jest.Mock;

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

  it('pickDocument adds a small doc as inline attachment', async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://doc.txt', name: 'doc.txt', size: 100 }],
    });
    mockReadDocumentText.mockResolvedValue('Short document content');

    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickDocument(); });

    expect(result.current.attachments).toHaveLength(1);
    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.strategy).toBe('inline');
    expect(att.inlineText).toBe('Short document content');
    expect(att.status).toBe('ready');
  });

  it('pickDocument marks large doc for RAG and stores firstChunk', async () => {
    const largeText = 'A'.repeat(5000);
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://big.pdf', name: 'big.pdf', size: 50000 }],
    });
    mockReadDocumentText.mockResolvedValue(largeText);

    const mockAddSource = jest.fn().mockResolvedValue({ success: true, sourceId: 42 });
    const { useSourceStore } = require('../store/sourceStore');
    useSourceStore.getState.mockReturnValue({ addSource: mockAddSource });

    const { result } = renderHook(() => useAttachment());
    await act(async () => { await result.current.pickDocument(); });

    const att = result.current.attachments[0];
    expect(att.type).toBe('document');
    expect(att.strategy).toBe('rag');
    expect(att.firstChunk).toBeDefined();
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
});
