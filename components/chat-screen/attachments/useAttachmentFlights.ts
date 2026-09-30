import { useCallback, useEffect, useState } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Flight } from './AttachmentFlight';
import { SPRING } from './constants';
import type { LibraryPhoto } from './usePhotoLibrary';

interface FlightOptions {
  hasAttachments: boolean;
  onAttachPhotos: (photos: LibraryPhoto[]) => void;
  collapsePanel: () => void;
  resetPanel: () => void;
  onSettled?: () => void;
}

export function useAttachmentFlights({
  hasAttachments,
  onAttachPhotos,
  collapsePanel,
  resetPanel,
  onSettled,
}: FlightOptions) {
  const [flights, setFlights] = useState<Flight[]>([]);

  const attach = useSharedValue(0);
  const strip = useSharedValue(0);

  useEffect(() => {
    strip.set(withSpring(hasAttachments ? 1 : 0, SPRING.strip));
  }, [hasAttachments, strip]);

  const settle = useCallback(() => {
    setFlights([]);
    onSettled?.();
    resetPanel();
  }, [onSettled, resetPanel]);

  useEffect(() => {
    if (flights.length) return;
    attach.set(0);
  }, [attach, flights]);

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
