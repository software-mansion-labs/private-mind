import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../../styles/fontStyles';
import { Theme } from '../../../styles/colors';
import { Source } from '../../../database/sourcesRepository';
import SourceCard from '../../sources/SourceCard';
import BottomSheetSearchInput from '../BottomSheetSearchInput';
import SecondaryButton from '../../SecondaryButton';
import TextButton from '../../TextButton';
import UploadIcon from '../../../assets/icons/upload.svg';
import PlusIcon from '../../../assets/icons/plus.svg';

interface Props {
  filteredSources: Source[];
  search: string;
  onSearchChange: (text: string) => void;
  onSourceToggle: (source: Source) => void;
  onUploadSource: () => void;
  onDismiss: () => void;
}

const SourceListSection = ({
  filteredSources,
  search,
  onSearchChange,
  onSourceToggle,
  onUploadSource,
  onDismiss,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      <Text style={styles.title}>Select source files</Text>

      <BottomSheetSearchInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search source files..."
      />

      <BottomSheetFlatList
        data={filteredSources}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.listContainer]}
        renderItem={({ item }) => (
          <SourceCard
            source={item}
            actionButton={
              <TouchableOpacity
                onPress={() => onSourceToggle(item)}
                hitSlop={15}
                style={styles.addButton}
              >
                <PlusIcon
                  style={{ color: theme.text.contrastPrimary }}
                  width={18}
                  height={18}
                />
              </TouchableOpacity>
            }
          />
        )}
      />

      <View style={styles.actionButtons}>
        <SecondaryButton
          icon={
            <UploadIcon
              style={{ color: theme.text.primary }}
              width={16}
              height={16}
            />
          }
          text="Upload source files"
          onPress={onUploadSource}
        />
        <TextButton
          text="Manage reference documents"
          style={styles.manageButton}
          onPress={() => {
            onDismiss();
            router.push('/sources');
          }}
        />
      </View>
    </>
  );
};

export default SourceListSection;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      paddingHorizontal: 16,
    },
    listContainer: {
      gap: 8,
      paddingHorizontal: 16,
    },
    addButton: {
      borderRadius: 9999,
      backgroundColor: theme.bg.main,
      padding: 8,
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionButtons: {
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
      gap: 8,
    },
    manageButton: {
      borderWidth: 0,
    },
  });
