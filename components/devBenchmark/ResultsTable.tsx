import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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

  const renderScenarioCell = (model: ModelResult, title: string) => {
    const scenario = model.scenarios.find((item) => item.title === title);
    if (!scenario) {
      return (
        <View key={title} style={styles.cell}>
          <Text style={styles.muted}>–</Text>
        </View>
      );
    }
    return (
      <View
        key={title}
        style={[
          styles.cell,
          styles.verdictCell,
          { backgroundColor: verdictColor(theme, scenario.verdict) },
        ]}
      >
        <Text style={styles.verdictText}>{scenarioLabel(scenario)}</Text>
      </View>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.row}>
          <Text style={[styles.modelCell, styles.header]}>Model</Text>
          <Text style={[styles.cell, styles.header]}>Load</Text>
          <Text style={[styles.cell, styles.header]}>tok/s</Text>
          {scenarioTitles.map((title) => (
            <Text key={title} style={[styles.cell, styles.header]}>
              {title}
            </Text>
          ))}
        </View>
        {run.models.map((model) => (
          <View key={model.modelId} style={styles.row}>
            <View style={styles.modelCell}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: verdictColor(theme, model.verdict) },
                ]}
              />
              <Text numberOfLines={2} style={styles.text}>
                {model.modelName}
              </Text>
            </View>
            <Text style={[styles.cell, styles.text]}>{formatLoad(model)}</Text>
            <Text style={[styles.cell, styles.text]}>{formatSpeed(model)}</Text>
            {scenarioTitles.map((title) => renderScenarioCell(model, title))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border.soft,
    },
    modelCell: {
      width: 150,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    cell: {
      width: 72,
      textAlign: 'center',
      alignItems: 'center',
    },
    verdictCell: {
      borderRadius: 6,
      paddingVertical: 4,
    },
    header: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    text: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    muted: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
    verdictText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.contrastPrimary,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
  });
