import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../../styles/fontStyles';
import { Theme } from '../../../styles/colors';
import { Source } from '../../../database/sourcesRepository';
import ActivatedSourceCard from '../../sources/ActivatedSourceCard';

interface Props {
  activeSources: Source[];
}

const ActiveSourcesSection = ({ activeSources }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (activeSources.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Files used in this chat</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{activeSources.length}</Text>
        </View>
      </View>
      <BottomSheetFlatList
        data={activeSources}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.listContainer]}
        renderItem={({ item }) => <ActivatedSourceCard source={item} />}
      />
    </View>
  );
};

export default ActiveSourcesSection;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: 24,
      maxHeight: 170,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    countBadge: {
      borderRadius: 9999,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
    },
    countText: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.contrastPrimary,
    },
    listContainer: {
      gap: 8,
      paddingHorizontal: 16,
    },
  });