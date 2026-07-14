import React, {
  type ReactNode,
  type ReactElement,
  type Ref,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  ModalBottomSheet,
  type Detent,
} from '@swmansion/react-native-bottom-sheet';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { HANDLE_ZONE, OPEN_INDEX } from '../../constants/bottom-sheet';

export interface AppBottomSheetRef<T = unknown> {
  present: (data?: T) => void;
  dismiss: () => void;
  close: () => void;
}

type SnapPoint = number | `${number}%`;

type Children<T> = ReactNode | ((state: { data?: T }) => ReactNode);

interface Props<T> {
  snapPoints?: SnapPoint[];
  dynamic?: boolean;
  onChange?: (index: number) => void;
  onDismiss?: () => void;
  backgroundColor?: string;
  handleColor?: string;
  children: Children<T>;
}

function AppBottomSheetInner<T>(
  {
    snapPoints,
    dynamic,
    onChange,
    onDismiss,
    backgroundColor,
    handleColor,
    children,
  }: Props<T>,
  ref: Ref<AppBottomSheetRef<T>>
) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { height } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [data, setData] = useState<T | undefined>(undefined);
  const wasOpen = useRef(false);

  const detents = useMemo<Detent[]>(() => {
    if (dynamic || !snapPoints || snapPoints.length === 0) {
      return [0, 'content'];
    }
    return [
      0,
      ...snapPoints.map((point) =>
        typeof point === 'number' ? point : (parseFloat(point) / 100) * height
      ),
    ];
  }, [dynamic, snapPoints, height]);

  useImperativeHandle(
    ref,
    () => ({
      present: (payload?: T) => {
        setData(payload);
        setIndex(OPEN_INDEX);
        wasOpen.current = true;
        onChange?.(0);
      },
      dismiss: () => setIndex(0),
      close: () => setIndex(0),
    }),
    [onChange]
  );

  const handleIndexChange = useCallback(
    (next: number) => {
      setIndex(next);
      if (next >= OPEN_INDEX) {
        wasOpen.current = true;
        onChange?.(next - 1);
      }
    },
    [onChange]
  );

  const handleSettle = useCallback(
    (next: number) => {
      setIndex(next);
      if (next === 0 && wasOpen.current) {
        wasOpen.current = false;
        setData(undefined);
        onChange?.(-1);
        onDismiss?.();
      }
    },
    [onChange, onDismiss]
  );

  const surface = useMemo(
    () => (
      <View
        style={[styles.surface, backgroundColor ? { backgroundColor } : null]}
      >
        <View
          style={[
            styles.handle,
            handleColor ? { backgroundColor: handleColor } : null,
          ]}
        />
      </View>
    ),
    [styles.surface, styles.handle, backgroundColor, handleColor]
  );

  const rendered =
    typeof children === 'function'
      ? data !== undefined
        ? (children as (state: { data?: T }) => ReactNode)({ data })
        : null
      : children;

  return (
    <ModalBottomSheet
      detents={detents}
      index={index}
      onIndexChange={handleIndexChange}
      onSettle={handleSettle}
      animateContentHeight={false}
      scrimColor={theme.bg.overlay}
      surface={surface}
    >
      <View style={dynamic ? styles.contentDynamic : styles.contentFill}>
        {rendered}
      </View>
    </ModalBottomSheet>
  );
}

export const AppBottomSheet = forwardRef(AppBottomSheetInner) as <T = unknown>(
  props: Props<T> & { ref?: Ref<AppBottomSheetRef<T>> }
) => ReactElement;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    surface: {
      ...StyleSheet.absoluteFill,
      backgroundColor: theme.bg.softPrimary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      alignItems: 'center',
      paddingTop: 12,
    },
    handle: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    contentFill: {
      flex: 1,
      paddingTop: HANDLE_ZONE,
    },
    contentDynamic: {
      paddingTop: HANDLE_ZONE,
    },
  });
