import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import {
  useDevBenchmarkStore,
  type QueuedModelState,
} from '../../store/devBenchmarkStore';
import {
  copyForAiMarkdown,
  failedTurns,
  modelIssues,
  type FailedTurn,
} from '../../utils/devBenchmark/report';
import {
  runDevBenchmark,
  stopDevBenchmark,
} from '../../utils/devBenchmark/runner';
import { DEV_BENCHMARK_SCENARIOS } from '../../utils/devBenchmark/scenarios';
import type { BenchmarkMode } from '../../utils/devBenchmark/types';
import { ModelSelector } from '../benchmark/ModelSelector';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { IssueList } from './IssueList';
import { ResultsTable } from './ResultsTable';
import { TurnDetailModal } from './TurnDetailModal';

const MODE_LABELS: Record<BenchmarkMode, string> = {
  quick: 'Quick',
  full: 'Full',
};

const MODE_DESCRIPTIONS: Record<BenchmarkMode, string> = {
  quick: 'One downloaded model, every scenario.',
  full: 'Every model this device can run. Missing models download one by one.',
};

const QUEUE_STATE_LABELS: Record<QueuedModelState, string> = {
  waiting: 'waiting for download',
  downloading: 'downloading',
  ready: 'queued',
  testing: 'testing',
  tested: 'tested',
  skipped: 'skipped',
};

const SCENARIO_TITLES = DEV_BENCHMARK_SCENARIOS.map(
  (scenario) => scenario.title
);

export const DevBenchmarkScreen = () => {
  useDefaultHeader();
  const db = useSQLiteContext();
  const { styles } = useThemedStyles(createStyles);
  const status = useDevBenchmarkStore((state) => state.status);
  const activity = useDevBenchmarkStore((state) => state.activity);
  const run = useDevBenchmarkStore((state) => state.run);
  const queue = useDevBenchmarkStore((state) => state.queue);
  const regressions = useDevBenchmarkStore((state) => state.regressions);
  const reportPath = useDevBenchmarkStore((state) => state.reportPath);
  const [mode, setMode] = useState<BenchmarkMode>('quick');
  const [quickModel, setQuickModel] = useState<Model | undefined>();
  const [openTurn, setOpenTurn] = useState<FailedTurn | null>(null);

  const isBusy = status === 'running' || status === 'stopping';
  const canStart = !isBusy && (mode === 'full' || !!quickModel);
  const issues = useMemo(() => (run ? modelIssues(run) : []), [run]);
  const turns = useMemo(() => (run ? failedTurns(run) : []), [run]);

  const handleStart = () =>
    runDevBenchmark({
      db,
      mode,
      quickModel: mode === 'quick' ? quickModel : undefined,
    });

  const handleCopy = async () => {
    if (!run) return;
    await Clipboard.setStringAsync(copyForAiMarkdown(run, regressions));
    Toast.show({ type: 'defaultToast', text1: 'Copied the report for AI' });
  };

  const handleCloseTurn = () => setOpenTurn(null);

  const renderModeOption = (option: BenchmarkMode) => {
    const handleSelect = () => setMode(option);
    return (
      <Pressable
        key={option}
        disabled={isBusy}
        onPress={handleSelect}
        style={({ pressed }) => [
          styles.modeOption,
          mode === option && styles.modeOptionSelected,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.modeText, mode === option && styles.modeTextSelected]}
        >
          {MODE_LABELS[option]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.modes}>
          {(['quick', 'full'] as const).map(renderModeOption)}
        </View>
        <Text style={styles.caption}>{MODE_DESCRIPTIONS[mode]}</Text>
        {mode === 'quick' && (
          <ModelSelector model={quickModel} setSelectedModel={setQuickModel} />
        )}
        <Text style={styles.caption}>
          Keep this screen open: the screen stays on while the benchmark runs,
          and every scenario uses a temporary chat that is deleted afterwards.
        </Text>
        {isBusy ? (
          <SecondaryButton
            text={status === 'stopping' ? 'Stopping…' : 'Stop'}
            disabled={status === 'stopping'}
            onPress={stopDevBenchmark}
          />
        ) : (
          <PrimaryButton
            text="Run benchmark"
            disabled={!canStart}
            onPress={handleStart}
          />
        )}
        {!!activity && <Text style={styles.activity}>{activity}</Text>}
        {isBusy && queue.length > 0 && (
          <View style={styles.section}>
            {queue.map((entry) => (
              <Text key={entry.modelId} style={styles.caption}>
                {entry.modelName}: {QUEUE_STATE_LABELS[entry.state]}
              </Text>
            ))}
          </View>
        )}
        {run && (
          <>
            <Text style={styles.heading}>Results</Text>
            <Text style={styles.caption}>
              {run.appVersion} ({run.build}) · {run.device.name} ·{' '}
              {run.device.platform} {run.device.osVersion} · {run.device.ramGB}{' '}
              GB RAM
            </Text>
            <ResultsTable run={run} scenarioTitles={SCENARIO_TITLES} />
            <Text style={styles.heading}>Red and yellow</Text>
            <IssueList
              modelIssues={issues}
              failedTurns={turns}
              regressions={regressions}
              onOpenTurn={setOpenTurn}
            />
            <SecondaryButton text="Copy for AI" onPress={handleCopy} />
            {reportPath && (
              <Text selectable style={styles.caption}>
                {reportPath}
              </Text>
            )}
          </>
        )}
      </ScrollView>
      <TurnDetailModal failedTurn={openTurn} onClose={handleCloseTurn} />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      gap: 16,
      padding: 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    modes: {
      flexDirection: 'row',
      gap: 8,
    },
    modeOption: {
      flex: 1,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.softSecondary,
    },
    modeOptionSelected: {
      backgroundColor: theme.bg.main,
    },
    modeText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    modeTextSelected: {
      color: theme.text.onBrand,
    },
    pressed: {
      opacity: 0.6,
    },
    section: {
      gap: 4,
    },
    heading: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    activity: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    caption: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
  });
