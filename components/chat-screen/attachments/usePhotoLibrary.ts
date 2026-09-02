import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';

/** How many library assets to pull in. */
const PAGE_SIZE = 180;

export interface LibraryPhoto {
  /** The asset's stable id — the selection key and the strip's React key. */
  id: string;
  /** `ph://…` (iOS) or `file://…` (Android); `expo-image` loads both. */
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

/**
 * The most recent photos from the device library, newest first. A limited
 * selection on iOS reads as granted — the OS hands back only what the user
 * shared, which is exactly the set the grid should show.
 */
export function usePhotoLibrary(active: boolean): PhotoLibrary {
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

  // Asked for only once the grid is actually on its way up — a privacy-first
  // app has no business prompting for the library while the menu is shut.
  useEffect(() => {
    if (!active) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [active, permission, requestPermission]);

  useEffect(() => {
    if (!active || !permission) return;
    if (isReadable(permission)) {
      load();
    } else if (!permission.canAskAgain) {
      setStatus('denied');
    }
  }, [active, permission, load]);

  return { photos, status };
}
