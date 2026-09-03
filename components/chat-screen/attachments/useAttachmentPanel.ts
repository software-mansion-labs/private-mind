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
import type { MenuAction } from './AttachmentMenu';

export type Mode = 'closed' | 'menu' | 'photos' | 'camera';

/**
 * What the panel turns into once it stops being the menu. Kept apart from
 * `mode` because it has to outlive it: on the way back to the menu the sheet is
 * still crossfading out, and swapping its contents mid-fade would flash the
 * other sheet through it.
 */
export type Sheet = 'photos' | 'camera';

interface PanelOptions {
  /** Called whenever the panel walks away from a sheet, so the caller can drop
   *  the sheet's selection with it. */
  onLeaveSheet?: () => void;
  /**
   * The Files row. May return a promise — the panel then waits for it before
   * collapsing, so the menu stays up while the OS takes its time presenting the
   * document picker instead of leaving a blank screen behind.
   */
  onSelectFiles?: () => void | Promise<unknown>;
  /** Guard for the image rows when the loaded model has no vision support. */
  canAttachImages?: boolean;
  /** Called when an image row is tapped on a model that cannot take images. */
  onImagesUnsupported?: () => void;
}

/**
 * The panel's state machine: closed ⇄ menu ⇄ one of the sheets. It owns every
 * shared value the panel morphs on and every way in and out of it — except the
 * attach-and-leave close, which belongs to the flights and drives the panel
 * through `collapseForLeave` / `resetAfterLeave`.
 */
export function useAttachmentPanel({
  onLeaveSheet,
  onSelectFiles,
  canAttachImages = true,
  onImagesUnsupported,
}: PanelOptions = {}) {
  const [mode, setMode] = useState<Mode>('closed');
  const [sheet, setSheet] = useState<Sheet>('photos');
  /** True for the length of a close, whichever way it was asked for. */
  const [closing, setClosing] = useState(false);
  /** Pending panel mount, held back while the + gets out of the way. */
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Pending reset of `sheet` once the crossfade back to the menu is over. */
  const sheetResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useSharedValue(0);
  /**
   * 0 the + is in place → 1 it has cleared the space the panel opens on. Its
   * own value rather than a read of `open`: it leads on the way in and trails
   * on the way out.
   */
  const plusOut = useSharedValue(0);
  const morph = useSharedValue(0);
  const menuOpacity = useSharedValue(1);
  const gridOpacity = useSharedValue(0);
  const blur = useSharedValue(0);

  useEffect(
    () => () => {
      if (leadTimer.current !== null) clearTimeout(leadTimer.current);
      if (sheetResetTimer.current !== null) {
        clearTimeout(sheetResetTimer.current);
      }
    },
    []
  );

  /**
   * Tearing down the over-keyboard window drops the keyboard with it while
   * leaving the field logically focused, which means a later tap on the field
   * is a no-op and the keyboard never returns.
   */
  const closeSheet = useCallback(() => {
    setMode('closed');
    setClosing(false);
    KeyboardController.setFocusTo('current');
  }, []);

  /** Soften, then sharpen: the panel blurs through every change it makes. */
  const pulseBlur = useCallback(() => {
    blur.set(
      withSequence(
        withTiming(1, { duration: 60, easing: EASE_OUT }),
        withTiming(0, { duration: DURATION.blur, easing: EASE_FADE })
      )
    );
  }, [blur]);

  /** Drops a queued lead-in, so a tap during it never lets the panel arrive. */
  const clearLead = useCallback(() => {
    if (leadTimer.current === null) return;
    clearTimeout(leadTimer.current);
    leadTimer.current = null;
  }, []);

  const openMenu = useCallback(() => {
    Feedback.sheetOpen();
    // The + goes first and alone: the panel opens as the circle around that
    // glyph and is wider than it, so it has to be absent for the lead, not
    // small.
    plusOut.set(withSpring(1, SPRING.panel));
    morph.set(0);
    gridOpacity.set(0);
    menuOpacity.set(1);
    blur.set(1);
    clearLead();
    leadTimer.current = setTimeout(() => {
      leadTimer.current = null;
      setMode('menu');
      // A spring rather than a curve: an ease-out is already a fifth of the way
      // out by the second frame and the circle is never seen.
      open.set(withSpring(1, SPRING.panel));
      blur.set(withTiming(0, { duration: DURATION.blur, easing: EASE_FADE }));
    }, DURATION.plusLead);
  }, [blur, clearLead, gridOpacity, menuOpacity, morph, open, plusOut]);

  const dismiss = useCallback(() => {
    clearLead();
    onLeaveSheet?.();
    // Hands the material to its own native transition for the way out. Its
    // opacity cannot carry this — a GlassView under an animated opacity renders
    // nothing at all, even at 1.
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
    // The same order read backwards: the panel goes, then the + comes back into
    // the space it leaves.
    plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
  }, [
    blur,
    clearLead,
    closeSheet,
    gridOpacity,
    menuOpacity,
    morph,
    onLeaveSheet,
    open,
    plusOut,
  ]);

  /** Menu → sheet. One morph whatever the sheet is: the camera takes exactly
   *  the footprint the grid does. */
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
    // `sheet` outlives `mode` only for the length of the crossfade — long
    // enough that going back does not flash the other sheet, and no longer.
    // Holding it forever keeps the camera's layer mounted, and on Android the
    // preview's surface stays painted where the menu no longer covers it.
    if (sheetResetTimer.current !== null) clearTimeout(sheetResetTimer.current);
    sheetResetTimer.current = setTimeout(() => {
      sheetResetTimer.current = null;
      setSheet('photos');
    }, DURATION.crossfade);
    pulseBlur();
    morph.set(withSpring(0, SPRING.panel));
    menuOpacity.set(
      withTiming(1, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
    gridOpacity.set(
      withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
  }, [gridOpacity, menuOpacity, morph, onLeaveSheet, pulseBlur]);

  const onMenuAction = useCallback(
    (action: MenuAction) => {
      if (action === 'files') {
        const picking = onSelectFiles?.();
        // The picker is the OS's to present, and on a cold Files provider that
        // takes seconds. Collapsing first leaves nothing on screen for the
        // whole of it, so the menu holds until the picker is up or gone.
        if (
          picking &&
          typeof (picking as Promise<unknown>).then === 'function'
        ) {
          (picking as Promise<unknown>).then(dismiss, dismiss);
        } else {
          dismiss();
        }
        return;
      }
      if (!canAttachImages) {
        onImagesUnsupported?.();
        return;
      }
      showSheet(action === 'camera' ? 'camera' : 'photos');
    },
    [canAttachImages, dismiss, onImagesUnsupported, onSelectFiles, showSheet]
  );

  const onPlusPress = useCallback(() => {
    // A lead-in is in flight for its whole length while `mode` is still shut,
    // so the ref is what says whether this tap is opening or closing.
    if (mode === 'closed' && leadTimer.current === null) openMenu();
    else dismiss();
  }, [dismiss, mode, openMenu]);

  /**
   * The panel's half of an attach-and-leave. No completion callback here: the
   * flight is what decides when it is over.
   */
  const collapseForLeave = useCallback(() => {
    setClosing(true);
    blur.set(withTiming(1, { duration: DURATION.panel, easing: EASE_FADE }));
    gridOpacity.set(
      withTiming(0, { duration: DURATION.crossfade, easing: EASE_FADE })
    );
    morph.set(withSpring(0, SPRING.panelOut));
    open.set(withSpring(0, SPRING.panelOut));
    plusOut.set(withDelay(DURATION.plusLead, withSpring(0, SPRING.panelOut)));
  }, [blur, gridOpacity, morph, open, plusOut]);

  /**
   * The panel's half of the flight landing. `plusOut` is deliberately
   * untouched: the + came back on its own spring while the photos flew.
   */
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
    dismiss,
    backToMenu,
    onMenuAction,
    collapseForLeave,
    resetAfterLeave,
  };
}
