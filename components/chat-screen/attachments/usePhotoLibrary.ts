import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 180;

export interface LibraryPhoto {
  id: string;
  uri: string;
}

export type LibraryStatus = 'loading' | 'denied' | 'empty' | 'ready';

export interface PhotoLibrary {
  photos: LibraryPhoto[];
  status: LibraryStatus;
  loadMore: () => void;
}

function isReadable(permission: MediaLibrary.PermissionResponse | null) {
  return (
    !!permission &&
    (permission.granted || permission.accessPrivileges === 'limited')
  );
}

export function usePhotoLibrary(read: boolean, ask: boolean): PhotoLibrary {
  const [permission, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo'],
  });
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');

  const latestRequest = useRef(0);
  const nextPage = useRef<{ after?: string; hasMore: boolean }>({
    hasMore: false,
  });
  const loadingMore = useRef(false);

  const readPage = (after?: string) =>
    MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      first: PAGE_SIZE,
      after,
    });

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    try {
      const page = await readPage();
      if (request !== latestRequest.current) return;
      nextPage.current = { after: page.endCursor, hasMore: page.hasNextPage };
      setPhotos(page.assets.map((asset) => ({ id: asset.id, uri: asset.uri })));
      setStatus(page.assets.length ? 'ready' : 'empty');
    } catch (error) {
      if (request !== latestRequest.current) return;
      console.error('Failed to read the photo library', error);
      setStatus('denied');
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextPage.current.hasMore || loadingMore.current) return;
    loadingMore.current = true;
    const request = latestRequest.current;
    try {
      const page = await readPage(nextPage.current.after);
      if (request !== latestRequest.current) return;
      nextPage.current = { after: page.endCursor, hasMore: page.hasNextPage };
      setPhotos((shown) => {
        const shownIds = new Set(shown.map((photo) => photo.id));
        const added = page.assets
          .filter((asset) => !shownIds.has(asset.id))
          .map((asset) => ({ id: asset.id, uri: asset.uri }));
        return [...shown, ...added];
      });
    } catch (error) {
      console.error('Failed to read more of the photo library', error);
    } finally {
      loadingMore.current = false;
    }
  }, []);

  useEffect(() => {
    if (!ask) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [ask, permission, requestPermission]);

  useEffect(() => {
    if (!read || !permission) return;
    if (isReadable(permission)) {
      load();
    } else if (!permission.canAskAgain) {
      setStatus('denied');
    }
  }, [read, permission, load]);

  const canRead = read && isReadable(permission);
  useEffect(() => {
    if (!canRead) return;
    const subscription = MediaLibrary.addListener(() => {
      load();
    });
    return () => subscription.remove();
  }, [canRead, load]);

  return { photos, status, loadMore };
}
