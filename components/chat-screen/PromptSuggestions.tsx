import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { space } from '../../constants/design-system';
import { PROMPT_SUGGESTION_ROWS } from '../../constants/default-prompts';
import DriftingPromptRow from './DriftingPromptRow';
import type { DriftDirection } from './promptRowMotion';

const ROW_DIRECTIONS: readonly DriftDirection[] = [-1, 1];

const useRowsRunning = (paused: boolean): boolean => {
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(
    AppState.currentState !== 'background'
  );

  const [screenReaderOn, setScreenReaderOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (mounted) setScreenReaderOn(enabled);
      })
      .catch((error) => {
        console.error('Failed to read the screen reader state:', error);
      });
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReaderOn
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return !paused && focused && appActive && !screenReaderOn;
};

interface Props {
  onSelectPrompt: (prompt: string) => void;
  paused?: boolean;
}

const PromptSuggestions = ({ onSelectPrompt, paused = false }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const running = useRowsRunning(paused);

  return (
    <View style={styles.container}>
      {PROMPT_SUGGESTION_ROWS.map((row, index) => (
        <DriftingPromptRow
          key={row[0]!.id}
          suggestions={row}
          direction={ROW_DIRECTIONS[index]!}
          running={running}
          onSelectPrompt={onSelectPrompt}
        />
      ))}
    </View>
  );
};

export default PromptSuggestions;

const createStyles = () =>
  StyleSheet.create({
    container: {
      gap: space.two,
    },
  });
