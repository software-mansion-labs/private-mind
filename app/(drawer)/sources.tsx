import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import FloatingActionButton from '../../components/model-hub/FloatingActionButton';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import SecondaryButton from '../../components/SecondaryButton';
import SearchIcon from '../../assets/icons/search.svg';
import UploadIcon from '../../assets/icons/upload.svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { CustomKeyboardAvoidingView } from '../../components/CustomKeyboardAvoidingView';
import TextFieldInput from '../../components/TextFieldInput';
import { Source } from '../../database/sourcesRepository';
import { FlatList } from 'react-native-gesture-handler';
import SourceCard from '../../components/sources/SourceCard';
import SourceManagementSheet from '../../components/bottomSheets/SourceManagementSheet';
import { useSourceStore } from '../../store/sourceStore';
import { useSourceUpload } from '../../hooks/useSourceUpload';
import MoreVerticalIcon from '../../assets/icons/more_vertical.svg';
import WarningSheet from '../../components/bottomSheets/WarningSheet';

const SourcesScreen = () => {
  useDefaultHeader();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { sources } = useSourceStore();
  const { uploadSource, isReading, warningSheetRef } = useSourceUpload();
  const sourceManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const [search, setSearch] = useState('');

  const filteredSources = useMemo(() => {
    return sources.filter((source) =>
      source.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, sources]);

  const handleSourcePress = useCallback((source: Source) => {
    sourceManagementSheetRef.current?.present(source);
  }, []);

  const renderEmptyState = () => (
    <View style={styles.noSourcesContainer}>
      <Text style={styles.emptyTitle}>
        There are no source files to display yet
      </Text>
      <SecondaryButton
        style={styles.emptyButton}
        icon={
          <UploadIcon
            width={18}
            height={18}
            style={{ color: theme.text.primary }}
          />
        }
        text="Add source files"
        onPress={uploadSource}
        disabled={isReading}
      />
    </View>
  );

  return (
    <CustomKeyboardAvoidingView style={styles.keyboardAvoidingView}>
      <View style={styles.container}>
        <View style={styles.horizontalInset}>
          <TextFieldInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search source files..."
            icon={
              <SearchIcon
                width={20}
                height={20}
                style={{ color: theme.text.primary }}
              />
            }
          />
        </View>
        <FlatList
          data={filteredSources}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContainerStyle,
            styles.horizontalInset,
          ]}
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => (
            <SourceCard
              source={item}
              actionButton={
                <TouchableOpacity
                  onPress={() => handleSourcePress(item)}
                  hitSlop={15}
                  style={styles.actionButton}
                >
                  <MoreVerticalIcon style={{ color: theme.text.primary }} />
                </TouchableOpacity>
              }
            />
          )}
        />
        <FloatingActionButton onPress={uploadSource} disabled={isReading} />
      </View>
      <SourceManagementSheet bottomSheetModalRef={sourceManagementSheetRef} />
      <WarningSheet bottomSheetModalRef={warningSheetRef} />
    </CustomKeyboardAvoidingView>
  );
};

export default SourcesScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      gap: 16,
      paddingTop: 16,
    },
    horizontalInset: {
      paddingHorizontal: 16,
    },
    listContainerStyle: {
      gap: 8,
      paddingBottom: theme.insets.bottom + 16 + 56,
    },
    noSourcesContainer: {
      justifyContent: 'center',
      alignItems: 'center',
      gap: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 12,
    },
    emptyTitle: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
    emptyButton: {
      width: '100%',
      height: 40,
    },
    actionButton: {
      borderRadius: 9999,
      backgroundColor: theme.bg.softSecondary,
      padding: 8,
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
