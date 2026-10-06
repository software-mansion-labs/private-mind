import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockRemove = jest.fn();
let mockLibraryChanged: (() => void) | undefined;

jest.mock('expo-media-library', () => ({
  MediaType: { photo: 'photo' },
  SortBy: { creationTime: 'creationTime' },
  usePermissions: jest.fn(),
  getAssetsAsync: jest.fn(),
  addListener: jest.fn((listener: () => void) => {
    mockLibraryChanged = listener;
    return { remove: mockRemove };
  }),
}));

import * as MediaLibrary from 'expo-media-library';
import { usePhotoLibrary } from '../components/chat-screen/attachments/usePhotoLibrary';

const mockUsePermissions = MediaLibrary.usePermissions as jest.Mock;
const mockGetAssets = MediaLibrary.getAssetsAsync as jest.Mock;

const page = (...ids: string[]) => ({
  assets: ids.map((id) => ({ id, uri: `file:///${id}.jpg` })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLibraryChanged = undefined;
  mockUsePermissions.mockReturnValue([
    { granted: true, canAskAgain: true },
    jest.fn(),
  ]);
});

it('shows a photo taken after the picker first loaded, without a restart', async () => {
  mockGetAssets.mockResolvedValueOnce(page()).mockResolvedValue(page('new'));

  const { result } = renderHook(() => usePhotoLibrary(true, true));
  await waitFor(() => expect(result.current.status).toBe('empty'));

  await act(async () => {
    mockLibraryChanged?.();
  });

  expect(result.current.status).toBe('ready');
  expect(result.current.photos.map((photo) => photo.id)).toEqual(['new']);
});

it('does not watch the library before the panel has been opened', () => {
  renderHook(() => usePhotoLibrary(false, false));

  expect(MediaLibrary.addListener).not.toHaveBeenCalled();
});

it('does not watch the library without photo access', () => {
  mockUsePermissions.mockReturnValue([
    { granted: false, canAskAgain: false },
    jest.fn(),
  ]);

  renderHook(() => usePhotoLibrary(true, true));

  expect(MediaLibrary.addListener).not.toHaveBeenCalled();
});

it('stops watching the library when the chat screen goes away', async () => {
  mockGetAssets.mockResolvedValue(page('a'));

  const { result, unmount } = renderHook(() => usePhotoLibrary(true, true));
  await waitFor(() => expect(result.current.status).toBe('ready'));
  unmount();

  expect(mockRemove).toHaveBeenCalled();
});

it('reaches photos older than the first page when the grid scrolls to its end', async () => {
  mockGetAssets
    .mockResolvedValueOnce({
      ...page('newest'),
      hasNextPage: true,
      endCursor: 'after-newest',
    })
    .mockResolvedValueOnce({ ...page('older'), hasNextPage: false });

  const { result } = renderHook(() => usePhotoLibrary(true, true));
  await waitFor(() => expect(result.current.status).toBe('ready'));

  await act(async () => {
    await result.current.loadMore();
  });

  expect(mockGetAssets).toHaveBeenLastCalledWith(
    expect.objectContaining({ after: 'after-newest' })
  );
  expect(result.current.photos.map((photo) => photo.id)).toEqual([
    'newest',
    'older',
  ]);
});

it('keeps the newest reading of the library when an older one answers late', async () => {
  let answerFirstRead!: (value: unknown) => void;
  mockGetAssets
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerFirstRead = resolve;
        })
    )
    .mockResolvedValue(page('after-change'));

  const { result } = renderHook(() => usePhotoLibrary(true, true));
  await waitFor(() => expect(mockLibraryChanged).toBeDefined());
  await act(async () => {
    mockLibraryChanged?.();
  });
  await act(async () => {
    answerFirstRead(page('before-change'));
  });

  expect(result.current.photos.map((photo) => photo.id)).toEqual([
    'after-change',
  ]);
});
