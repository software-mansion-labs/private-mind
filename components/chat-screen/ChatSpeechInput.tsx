import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, lineHeights } from '../../styles/fontStyles';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import CircleButton from '../CircleButton';
import TrashIcon from '../../assets/icons/trash.svg';
import SendIcon from '../../assets/icons/send_icon.svg';
import RecordingAnimation from './RecordingAnimation';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useStableCallback } from '../../hooks/useStableCallback';

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

const CANCEL_ANIMATION_DURATION = 500;

const ChatSpeechInput: React.FC<Props> = ({
  onSubmit: onSubmitProp,
  onCancel: onCancelProp,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const recordingAttemptedRef = React.useRef(false);
  const recordingStartTimeRef = React.useRef(0);
  const recordingActionRef = React.useRef<'cancel' | 'submit' | null>(null);
  /** in seconds */
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const animationRef =
    React.useRef<React.ComponentRef<typeof RecordingAnimation>>(null);

  const {
    downloadProgress,
    status,
    error,
    start,
    stop,
    committedTranscription,
    nonCommittedTranscription,
  } = useSpeechInput({
    onAudioData: (data) => {
      setRecordingDuration(
        Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
      );
      animationRef.current?.pushChunk(data);
    },
  });

  const onSubmit = useStableCallback(onSubmitProp);
  const onCancel = useStableCallback(onCancelProp);

  useEffect(() => {
    const startListening = async () => {
      recordingStartTimeRef.current = Date.now();
      const transcription = await start();
      if (transcription && recordingActionRef.current === 'submit') {
        onSubmit(transcription);
      } else if (recordingActionRef.current === 'cancel') {
        onCancel();
      }
    };

    if (status === 'idle' && !recordingAttemptedRef.current) {
      recordingAttemptedRef.current = true;
      startListening();
    }
  }, [status, onCancel, onSubmit]);

  const handledSpeechErrorRef = React.useRef(false);
  useEffect(() => {
    if (error && !handledSpeechErrorRef.current) {
      handledSpeechErrorRef.current = true;
      Toast.show({
        type: 'defaultToast',
        text1: 'Could not start live transcript',
      });
      onCancel();
    }
  }, [error, onCancel]);

  const animationWrapperRef = React.useRef<View | null>(null);
  const [animationWidth, setAnimationWidth] = React.useState(0);

  useLayoutEffect(() => {
    if (animationWrapperRef.current) {
      animationWrapperRef.current.measure((x, y, width) => {
        setAnimationWidth(Math.floor(width));
      });
    }
  }, []);

  const cancelAnimationProgress = useSharedValue(0);
  const wrapperStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        cancelAnimationProgress.value,
        [0, 0.5, 1],
        [theme.bg.main, theme.bg.errorPrimary, theme.bg.errorPrimary]
      ),
    };
  });

  const handleCancel = () => {
    stop();
    cancelAnimationProgress.value = withTiming(1, {
      duration: CANCEL_ANIMATION_DURATION,
    });

    setTimeout(onCancel, CANCEL_ANIMATION_DURATION);
  };

  const handleSend = async () => {
    recordingActionRef.current = 'submit';
    stop();
  };

  const renderTopNote = () => {
    const fullTranscription = (
      committedTranscription.trim() +
      ' ' +
      nonCommittedTranscription.trim()
    ).trim();

    if (fullTranscription) {
      return <ScrollableTranscript text={fullTranscription} />;
    }

    if (status === 'listening') {
      return (
        <Text style={styles.secondaryNote}>
          Start talking to see the live transcript...
        </Text>
      );
    }

    if (status === 'processing') {
      return <Text style={styles.secondaryNote}>Processing...</Text>;
    }

    const progressPercentage = Math.round(downloadProgress * 100);
    return (
      <Text style={styles.secondaryNote}>
        Loading... ({progressPercentage}%)
      </Text>
    );
  };

  return (
    <Animated.View style={[styles.container, wrapperStyle]}>
      {renderTopNote()}

      <View style={styles.recordingRow}>
        <RecordingInfo
          active={status === 'listening'}
          duration={recordingDuration}
        />
        <View
          ref={animationWrapperRef}
          style={styles.recordingAnimationWrapper}
        >
          {animationWidth > 0 && (
            <RecordingAnimation
              ref={animationRef}
              width={animationWidth}
              height={24}
            />
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <CircleButton
          icon={TrashIcon}
          onPress={handleCancel}
          size={20}
          color={theme.text.contrastPrimary}
          backgroundColor={theme.bg.overlay}
        />
        <Text style={[styles.secondaryNote, styles.actionNote]}>
          Click again to send
        </Text>
        <CircleButton
          icon={SendIcon}
          onPress={handleSend}
          color={theme.text.primary}
          backgroundColor={theme.bg.softPrimary}
        />
      </View>
    </Animated.View>
  );
};

export default ChatSpeechInput;

const RecordingInfo: React.FC<{
  active: boolean;
  /** in seconds */
  duration: number;
}> = ({ active, duration }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <View style={styles.recordingInfo}>
      <View style={[styles.recordingDot, !active && styles.recordingDotOff]} />
      <Text style={styles.note}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </Text>
    </View>
  );
};

const ScrollableTranscript: React.FC<{ text: string }> = ({ text }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <ScrollView style={styles.transcriptWrapper}>
      <View style={styles.transcriptContent}>
        <Text style={styles.note}>{text}</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.bg.main,
      borderRadius: 18,
      padding: 16,
      gap: 16,
    },

    note: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.contrastPrimary,
    },
    secondaryNote: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.contrastTertiary,
    },

    recordingRow: {
      backgroundColor: theme.bg.overlay,
      height: 40,
      borderRadius: 12,
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
    },
    recordingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    recordingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.bg.errorPrimary,
    },
    recordingDotOff: {
      backgroundColor: theme.text.contrastPrimary,
      opacity: 0.4,
    },
    recordingAnimationWrapper: {
      flex: 1,
    },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    actionNote: {
      flex: 1,
      textAlign: 'center',
    },

    transcriptWrapper: {
      maxHeight: lineHeights.xs * 3,
      transform: [{ scaleY: -1 }],
    },
    transcriptContent: {
      transform: [{ scaleY: -1 }],
    },
  });
