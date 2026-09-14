import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useEmbeddingDownloadPrompt } from '../components/chat-screen/useEmbeddingDownloadPrompt';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import {
  isHighMemoryDevice,
  isMemoryConstrained,
} from '../utils/modelCompatibility';
import type { Model } from '../database/modelRepository';
import type { EmbeddingModelStatus } from '../store/embeddingModelStore';

jest.mock('../utils/modelCompatibility', () => ({
  isHighMemoryDevice: jest.fn(() => false),
  isMemoryConstrained: jest.fn(() => false),
}));

const mockIsHighMemoryDevice = isHighMemoryDevice as jest.Mock;
const mockIsMemoryConstrained = isMemoryConstrained as jest.Mock;

const model = { id: 1, modelName: 'Test LLM' } as Model;

const setStatus = (status: EmbeddingModelStatus) =>
  act(() => {
    useEmbeddingModelStore.setState({ status });
  });

const setup = (webSearchEnabled: boolean, onWebSearchToggle = jest.fn()) => {
  const presentDownloadSheet = jest.fn();
  const markDownloadSheetClosed = jest.fn();
  const view = renderHook(
    (props: { webSearchEnabled: boolean }) =>
      useEmbeddingDownloadPrompt({
        model,
        webSearchEnabled: props.webSearchEnabled,
        onWebSearchToggle,
        presentDownloadSheet,
        markDownloadSheetClosed,
      }),
    { initialProps: { webSearchEnabled } }
  );
  return {
    ...view,
    onWebSearchToggle,
    presentDownloadSheet,
    markDownloadSheetClosed,
  };
};

describe('the embedding download prompt behind the web-search toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHighMemoryDevice.mockReturnValue(false);
    mockIsMemoryConstrained.mockReturnValue(false);
    setStatus('not_downloaded');
  });

  it('asks for the download when the toggle is switched on', async () => {
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalledTimes(1));
    expect(presentDownloadSheet).toHaveBeenCalledWith('none');
    await waitFor(() =>
      expect(result.current.embeddingSheetContext).toBe('web')
    );
  });

  it('resumes nothing after the download, so no picker opens by itself', async () => {
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalled());
    expect(presentDownloadSheet.mock.calls[0]).toEqual(['none']);
  });

  it('stays quiet when the toggle is switched off', async () => {
    const { result, presentDownloadSheet, onWebSearchToggle } = setup(true);
    act(() => result.current.handleWebSearchToggle());
    expect(onWebSearchToggle).toHaveBeenCalled();
    await Promise.resolve();
    expect(presentDownloadSheet).not.toHaveBeenCalled();
  });

  it('stays quiet when the screen refused to enable web search', async () => {
    const refused = jest.fn(() => false);
    const { result, presentDownloadSheet } = setup(false, refused);
    act(() => result.current.handleWebSearchToggle());
    await Promise.resolve();
    expect(presentDownloadSheet).not.toHaveBeenCalled();
  });

  it('stays quiet when the embedding model is already there', async () => {
    setStatus('ready');
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await Promise.resolve();
    expect(presentDownloadSheet).not.toHaveBeenCalled();
  });

  it('stays quiet on a device that cannot hold the embedding model', async () => {
    mockIsMemoryConstrained.mockReturnValue(true);
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await Promise.resolve();
    expect(presentDownloadSheet).not.toHaveBeenCalled();
  });

  it('waits for a status that is not yet known instead of reading unknown as missing', async () => {
    setStatus('unknown');
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await Promise.resolve();
    expect(presentDownloadSheet).not.toHaveBeenCalled();

    setStatus('not_downloaded');
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalledTimes(1));
  });

  it('drops a pending prompt when the toggle is flipped again first', async () => {
    setStatus('unknown');
    const { result, rerender, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    rerender({ webSearchEnabled: true });
    act(() => result.current.handleWebSearchToggle());

    await act(async () => {
      useEmbeddingModelStore.setState({ status: 'not_downloaded' });
      await Promise.resolve();
    });
    expect(presentDownloadSheet).not.toHaveBeenCalled();
  });
});

describe('dismissing the embedding sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHighMemoryDevice.mockReturnValue(false);
    mockIsMemoryConstrained.mockReturnValue(false);
    setStatus('not_downloaded');
  });

  it('turns web search back off when the download was required and did not happen', async () => {
    mockIsHighMemoryDevice.mockReturnValue(true);
    const { result, onWebSearchToggle, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.embeddingSheetRequired).toBe(true)
    );

    onWebSearchToggle.mockClear();
    act(() => result.current.handleEmbeddingSheetDismiss());
    expect(onWebSearchToggle).toHaveBeenCalledTimes(1);
  });

  it('leaves web search on when the download was only a suggestion', async () => {
    const { result, onWebSearchToggle, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalled());

    onWebSearchToggle.mockClear();
    act(() => result.current.handleEmbeddingSheetDismiss());
    expect(onWebSearchToggle).not.toHaveBeenCalled();
  });

  it('does not ask a second time once the suggestion has been dismissed', async () => {
    const { result, rerender, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalledTimes(1));
    act(() => result.current.handleEmbeddingSheetDismiss());

    rerender({ webSearchEnabled: true });
    act(() => result.current.handleWebSearchToggle());
    rerender({ webSearchEnabled: false });
    act(() => result.current.handleWebSearchToggle());
    await Promise.resolve();
    expect(presentDownloadSheet).toHaveBeenCalledTimes(1);
  });

  it('gives the sheet back to the document flow, so its copy is not reused', async () => {
    const { result, presentDownloadSheet } = setup(false);
    act(() => result.current.handleWebSearchToggle());
    await waitFor(() => expect(presentDownloadSheet).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.embeddingSheetContext).toBe('web')
    );

    act(() => result.current.handleEmbeddingSheetDismiss());
    expect(result.current.embeddingSheetContext).toBe('document');
    expect(result.current.embeddingSheetRequired).toBe(false);
  });

  it('always tells the attachment hook the sheet is closed', () => {
    const { result, markDownloadSheetClosed } = setup(false);
    act(() => result.current.handleEmbeddingSheetDismiss());
    expect(markDownloadSheetClosed).toHaveBeenCalledTimes(1);
  });
});
