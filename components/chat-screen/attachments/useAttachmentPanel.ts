import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';
import {
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Feedback } from '../../../utils/Feedback';
import { DURATION, EASE_FADE, EASE_OUT, SPRING } from './constants';
import type { DocumentPickOutcome } from '../../../hooks/useAttachment';
import type { MenuAction } from './AttachmentMenu';

export type Mode = 'closed' | 'menu' | 'photos' | 'camera';

const PRESS_SETTLE_MS = 80;
const WARM_OVERLAY_TIMEOUT_MS = 1000;

export type Sheet = 'photos' | 'camera';

interface PanelOptions {
  onLeaveSheet?: () => void;
  onSelectFiles?: () => void | Promise<DocumentPickOutcome | void>;
  onSelectPhotos?: () => Promise<DocumentPickOutcome | void>;
  canAttachImages?: boolean;
  onImagesUnsupported?: () => void;
  attachmentsBlocked?: boolean;
  onAttachmentsBlocked?: () => void;
}

export function useAttachmentPanel({
  onLeaveSheet,
  onSelectFiles,
  onSelectPhotos,
  canAttachImages = true,
  onImagesUnsupported,
  attachmentsBlocked = false,
  onAttachmentsBlocked,
}: PanelOptions = {}) {
  const [mode, setMode] = useState<Mode>('closed');
  const [sheet, setSheet] = useState<Sheet>('photos');
  const [closing, setClosing] = useState(false);
  const [overlayWarm, setOverlayWarm] = useState(false);
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refocusOnCloseRef = useRef(true);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingOverlayLayout = useRef(false);
  const overlayLaidOut = useRef(false);
  const openRequested = useRef(false);

  const open = useSharedValue(0);
  const plusOut = useSharedValue(0);
  const morph = useSharedValue(0);
  const menuOpacity = useSharedValue(1);
  const gridOpacity = useSharedValue(0);
  const blur = useSharedValue(0);

  useEffect(
    () => () => {
      if (leadTimer.current !== null) clearTimeout(leadTimer.current);
      if (warmTimer.current !== null) clearTimeout(warmTimer.current);
      if (sheetResetTimer.current !== null) {
        clearTimeout(sheetResetTimer.current);
      }
    },
    []
  );

  const closeSheet = useCallback(() => {
    openRequested.current = false;
    overlayLaidOut.current = false;
    setOverlayWarm(false);
    setMode('closed');
    setClosing(false);
    if (refocusOnCloseRef.current) KeyboardController.setFocusTo('current');
    refocusOnCloseRef.current = true;
  }, []);

  const pulseBlur = useCallback(() => {
    blur.set(
      withSequence(
        withTiming(1, { duration: 60, easing: EASE_OUT }),
        withTiming(0, { duration: DURATION.blur, easing: EASE_FADE })
      )
    );
  }, [blur]);

  const clearLead = useCallback(() => {
    awaitingOverlayLayout.current = false;
    if (leadTimer.current === null) return;
    clearTimeout(leadTimer.current);
    leadTimer.current = null;
  }, []);

  const startOpening = useCallback(() => {
    awaitingOverlayLayout.current = false;
    open.set(withSpring(1, SPRING.panel));
    blur.set(withTiming(0, { duration: DURATION.blur, easing: EASE_FADE }));
  }, [blur, open]);

  const coolOverlay = useCallback(() => {
    if (warmTimer.current !== null) {
      clearTimeout(warmTimer.current);
      warmTimer.current = null;
    }
    if (openRequested.current) return;
    overlayLaidOut.current = false;
    setOverlayWarm(false);
  }, []);

  const openMenu = useCallback(() => {
    openRequested.current = true;
    Feedback.sheetOpen();
    plusOut.set(withSpring(1, SPRING.panel));
    morph.set(0);
    gridOpacity.set(0);
    menuOpacity.set(1);
    blur.set(1);
    clearLead();
    leadTimer.current = setTimeout(() => {
      leadTimer.current = null;
      setMode('menu');
      if (overlayLaidOut.current) startOpening();
      else awaitingOverlayLayout.current = true;
    }, DURATION.plusLead);
  }, [blur, clearLead, gridOpacity, menuOpacity, morph, plusOut, startOpening]);

  const onOverlayLayout = useCallback(() => {
    overlayLaidOut.current = true;
    if (awaitingOverlayLayout.current) startOpening();
  }, [startOpening]);

  const onPlusPressIn = useCallback(() => {
    if (mode !== 'closed' || openRequested.current) return;
    setOverlayWarm(true);
    if (warmTimer.current !== null) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(coolOverlay, WARM_OVERLAY_TIMEOUT_MS);
  }, [coolOverlay, mode]);

  const onPlusPressOut = useCallback(() => {
    if (warmTimer.current !== null) clearTimeout(warmTimer.current);
    warmTimer.current = setTimeout(coolOverlay, PRESS_SETTLE_MS);
  }, [coolOverlay]);

  const closePanel = useCallback(
    (refocus: boolean) => {
      refocusOnCloseRef.current = refocus;
      clearLead();
      onLeaveSheet?.();
      setClosing(true);
      blur.set(withTiming(1, { duration: DURATION.panel, easing: EASE_FADE }));
      morph.set(withSpring(0, SPRING.panelOut));
      menuOpacity.set(
        withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE })
      );
      gridOpacity.set(
        withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
      );
      open.set(
        withSpring(0, SPRING.panelOut, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(closeSheet);
        })
      );
      plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
    },
    [
      blur,
      clearLead,
      closeSheet,
      gridOpacity,
      menuOpacity,
      morph,
      onLeaveSheet,
      open,
      plusOut,
    ]
  );

  const dismiss = useCallback(() => closePanel(true), [closePanel]);

  const showSheet = useCallback(
    (next: Sheet) => {
      if (sheetResetTimer.current !== null) {
        clearTimeout(sheetResetTimer.current);
        sheetResetTimer.current = null;
      }
      setSheet(next);
      setMode(next);
      pulseBlur();
      morph.set(withSpring(1, SPRING.panel));
      menuOpacity.set(
        withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
      );
      gridOpacity.set(
        withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE })
      );
    },
    [gridOpacity, menuOpacity, morph, pulseBlur]
  );

  const backToMenu = useCallback(() => {
    setMode('menu');
    onLeaveSheet?.();
    if (sheetResetTimer.current !== null) clearTimeout(sheetResetTimer.current);
    sheetResetTimer.current = setTimeout(() => {
      sheetResetTimer.current = null;
      setSheet('photos');
    }, DURATION.panel);
    pulseBlur();
    morph.set(withSpring(0, SPRING.panel));
    menuOpacity.set(
      withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
    gridOpacity.set(
      withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
  }, [gridOpacity, menuOpacity, morph, onLeaveSheet, pulseBlur]);

  const dismissWithoutRefocus = useCallback(
    () => closePanel(false),
    [closePanel]
  );

  const dismissUnlessCanceled = useCallback(
    (picking: void | Promise<DocumentPickOutcome | void>) => {
      if (picking && typeof (picking as Promise<unknown>).then === 'function') {
        (picking as Promise<DocumentPickOutcome | void>).then((outcome) => {
          if (outcome === 'canceled') return;
          if (outcome === 'awaiting-download') dismissWithoutRefocus();
          else dismiss();
        }, dismiss);
      } else {
        dismiss();
      }
    },
    [dismiss, dismissWithoutRefocus]
  );

  const onMenuAction = useCallback(
    (action: MenuAction) => {
      if (attachmentsBlocked) {
        onAttachmentsBlocked?.();
        return;
      }
      if (action === 'files') {
        dismissUnlessCanceled(onSelectFiles?.());
        return;
      }
      if (!canAttachImages) {
        dismiss();
        onImagesUnsupported?.();
        return;
      }
      if (action === 'photos' && onSelectPhotos) {
        dismissUnlessCanceled(onSelectPhotos());
        return;
      }
      showSheet(action === 'camera' ? 'camera' : 'photos');
    },
    [
      attachmentsBlocked,
      canAttachImages,
      dismiss,
      dismissUnlessCanceled,
      onAttachmentsBlocked,
      onImagesUnsupported,
      onSelectFiles,
      onSelectPhotos,
      showSheet,
    ]
  );

  const onPlusPress = useCallback(() => {
    if (mode === 'closed' && leadTimer.current === null) openMenu();
    else dismiss();
  }, [dismiss, mode, openMenu]);

  const collapseForLeave = useCallback(() => {
    awaitingOverlayLayout.current = false;
    setClosing(true);
    blur.set(withTiming(1, { duration: DURATION.panel, easing: EASE_FADE }));
    gridOpacity.set(
      withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
    morph.set(withSpring(0, SPRING.panelOut));
    open.set(withSpring(0, SPRING.panelOut));
    plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
  }, [blur, gridOpacity, morph, open, plusOut]);

  const resetAfterLeave = useCallback(() => {
    closeSheet();
    open.set(0);
    morph.set(0);
    gridOpacity.set(0);
    menuOpacity.set(1);
    blur.set(0);
  }, [blur, closeSheet, gridOpacity, menuOpacity, morph, open]);

  return {
    mode,
    sheet,
    closing,
    open,
    plusOut,
    morph,
    menuOpacity,
    gridOpacity,
    blur,
    onPlusPress,
    onPlusPressIn,
    onPlusPressOut,
    overlayWarm,
    onOverlayLayout,
    dismiss,
    dismissWithoutRefocus,
    backToMenu,
    onMenuAction,
    collapseForLeave,
    resetAfterLeave,
  };
}
