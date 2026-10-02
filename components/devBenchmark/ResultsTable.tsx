import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { passedTurnCount } from '../../utils/devBenchmark/report';
import type {
  BenchmarkRun,
  ModelResult,
  ScenarioResult,
} from '../../utils/devBenchmark/types';
import { verdictColor } from './verdictColor';

interface Props {
  run: BenchmarkRun;
  scenarioTitles: string[];
}

const formatLoad = (model: ModelResult): string =>
  model.loadMs === undefined ? '–' : `${(model.loadMs / 1000).toFixed(1)} s`;

const formatSpeed = (model: ModelResult): string =>
  model.speed ? model.speed.tokPerS.toFixed(1) : '–';

const scenarioLabel = (scenario: ScenarioResult): string =>
  `${passedTurnCount(scenario)}/${scenario.turns.length}`;

export const ResultsTable = ({ run, scenarioTitles }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const renderMetric = (label: string, value: string) => (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const renderScenarioRow = (model: ModelResult, title: string) => {
    const scenario = model.scenarios.find((item) => item.title === title);
    return (
      <View key={title} style={styles.scenarioRow}>
        <Text numberOfLines={1} style={styles.scenarioTitle}>
          {title}
        </Text>
        {scenario ? (
          <View
            style={[
              styles.score,
              { backgroundColor: verdictColor(theme, scenario.verdict) },
            ]}
          >
            <Text style={styles.scoreText}>{scenarioLabel(scenario)}</Text>
          </View>
        ) : (
          <Text style={[styles.score, styles.muted]}>–</Text>
        )}
      </View>
    );
  };

  return (
    <View>
      {run.models.map((model) => (
        <View key={model.modelId} style={styles.model}>
          <View style={styles.modelHeader}>
            <View
              style={[
                styles.dot,
                { backgroundColor: verdictColor(theme, model.verdict) },
              ]}
            />
            <Text numberOfLines={2} style={styles.modelName}>
              {model.modelName}
            </Text>
            {renderMetric('load', formatLoad(model))}
            {renderMetric('tok/s', formatSpeed(model))}
          </View>
          {scenarioTitles.map((title) => renderScenarioRow(model, title))}
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    model: {
      gap: 6,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border.soft,
    },
    modelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    modelName: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    metric: {
      width: 56,
      alignItems: 'flex-end',
    },
    metricValue: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    metricLabel: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    scenarioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 16,
    },
    scenarioTitle: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    score: {
      minWidth: 56,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
      alignItems: 'center',
      textAlign: 'center',
    },
    scoreText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.contrastPrimary,
    },
    muted: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
  });
