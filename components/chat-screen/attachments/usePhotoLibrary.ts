import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';

const PAGE_SIZE = 180;

export interface LibraryPhoto {
  id: string;
  uri: string;
}

export type LibraryStatus = 'loading' | 'denied' | 'empty' | 'ready';

export interface PhotoLibrary {
  photos: LibraryPhoto[];
  status: LibraryStatus;
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

  const load = useCallback(async () => {
    try {
      const page = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        first: PAGE_SIZE,
      });
      setPhotos(page.assets.map((asset) => ({ id: asset.id, uri: asset.uri })));
      setStatus(page.assets.length ? 'ready' : 'empty');
    } catch (error) {
      console.error('Failed to read the photo library', error);
      setStatus('denied');
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

  return { photos, status };
}
