import { useCallback, useEffect, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Flight } from './AttachmentFlight';
import { SPRING } from './constants';
import type { LibraryPhoto } from './usePhotoLibrary';

interface FlightOptions {
  /** Whether the composer currently has a strip to grow around. */
  hasAttachments: boolean;
  /** Hands the picked photos to whoever owns the attachment list. */
  onAttachPhotos: (photos: LibraryPhoto[]) => void;
  /** The panel's half of the leave. */
  collapsePanel: () => void;
  /** The panel's half of the landing. */
  resetPanel: () => void;
  /** Called as the flight lands, so the caller can drop its selection. */
  onSettled?: () => void;
}

/**
 * The photos flying into the composer. It owns the two shared values both ends
 * of the flight read — `attach`, the flight's own progress, and `strip`, the
 * slot it is aiming at — and `attachAndLeave`, which sends the photos to the
 * composer while the panel collapses under them.
 */
export function useAttachmentFlights({
  hasAttachments,
  onAttachPhotos,
  collapsePanel,
  resetPanel,
  onSettled,
}: FlightOptions) {
  /** The photos currently crossing from the grid to the composer. */
  const [flights, setFlights] = useState<Flight[]>([]);

  const attach = useSharedValue(0);
  /**
   * 0 no attachment strip → 1 strip open. Two views need it: the composer,
   * which grows around it, and the photos flying into it.
   */
  const strip = useSharedValue(0);

  useEffect(() => {
    strip.set(withSpring(hasAttachments ? 1 : 0, SPRING.strip));
  }, [hasAttachments, strip]);

  /** Runs when the flight lands, handing the thumbnails over to the composer. */
  const settle = useCallback(() => {
    // The hand-off on one commit: the flying copies come off in the same breath
    // the composer's own thumbnails stop being held back. An await or a timer
    // here would split it in two and double-expose a photo.
    setFlights([]);
    onSettled?.();
    attach.set(0);
    resetPanel();
  }, [attach, onSettled, resetPanel]);

  /**
   * Hands a set of photos to the composer and sends the sheet home. Shared by
   * the grid's confirm and the camera's shutter.
   */
  const attachAndLeave = useCallback(
    (leaving: Flight[]) => {
      setFlights(leaving);
      onAttachPhotos(leaving.map((flight) => flight.photo));
      collapsePanel();

      attach.set(
        withSpring(1, SPRING.attach, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(settle);
        })
      );
    },
    [attach, collapsePanel, onAttachPhotos, settle]
  );

  return {
    flights,
    isFlying: flights.length > 0,
    attach,
    strip,
    attachAndLeave,
  };
}
