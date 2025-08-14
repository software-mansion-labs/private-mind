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
import * as DocumentPicker from 'expo-document-picker';
import { Source } from '../../database/sourcesRepository';
import { FlatList } from 'react-native-gesture-handler';
import SourceCard from '../../components/sources/SourceCard';
import SourceManagementSheet from '../../components/bottomSheets/SourceManagementSheet';
import { useVectorStore } from '../../context/VectorStoreContext';
import { useSourceStore } from '../../store/sourceStore';
import MoreVerticalIcon from '../../assets/icons/more_vertical.svg';

const SourcesScreen = () => {
  useDefaultHeader();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { vectorStore } = useVectorStore();
  const { sources, addSource } = useSourceStore();
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

  const uploadSource = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri || '';
      const newSource: Omit<Source, 'id'> = {
        name:
          asset.name.split('.')[0] ||
          asset.uri.split('/').pop()?.split('.')[0] ||
          'Unnamed',
        type: asset.uri.split('.').pop() || '',
        size: asset.size || null,
      };

      await addSource(newSource, uri, vectorStore!);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.noSourcesContainer}>
      <Text style={styles.emptyTitle}>
        There are no source files to display yet
      </Text>
      <SecondaryButton
        style={{ width: '100%', height: 40 }}
        icon={
          <UploadIcon
            width={18}
            height={18}
            style={{ color: theme.text.primary }}
          />
        }
        text="Add source files"
        onPress={uploadSource}
      />
    </View>
  );

  return (
    <CustomKeyboardAvoidingView style={styles.keyboardAvoidingView}>
      <View style={styles.container}>
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
        <FlatList
          data={filteredSources}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ gap: 8 }}
          ListEmptyComponent={renderEmptyState}
          renderItem={({ item }) => (
            <SourceCard
              source={item}
              actionButton={
                <TouchableOpacity
                  onPress={() => handleSourcePress(item)}
                  hitSlop={15}
                  style={{
                    borderRadius: 9999,
                    backgroundColor: theme.bg.softSecondary,
                    padding: 8,
                    width: 36,
                    height: 36,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <MoreVerticalIcon style={{ color: theme.text.primary }} />
                </TouchableOpacity>
              }
            />
          )}
        />
        <FloatingActionButton onPress={uploadSource} />
      </View>
      <SourceManagementSheet bottomSheetModalRef={sourceManagementSheetRef} />
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
      paddingHorizontal: 16,
    },
    horizontalInset: {
      paddingHorizontal: 16,
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
    modelScrollContent: {
      // 56 is the FAB size
      paddingBottom: theme.insets.bottom + 16 + 56,
    },
  });
