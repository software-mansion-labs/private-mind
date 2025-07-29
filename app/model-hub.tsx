import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import useDefaultHeader from '../hooks/useDefaultHeader';
import { useModelStore } from '../store/modelStore';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import ModelManagementSheet from '../components/bottomSheets/ModelManagementSheet';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import TextFieldInput from '../components/TextFieldInput';
import SearchIcon from '../assets/icons/search.svg';
import SecondaryButton from '../components/SecondaryButton';
import QuestionIcon from '../assets/icons/question.svg';
import AddModelSheet from '../components/bottomSheets/AddModelSheet';
import MemoryWarningSheet from '../components/bottomSheets/MemoryWarningSheet';
import SortingTag from '../components/model-hub/SortingTag';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';
import useModelHubData from '../hooks/useModelHubData';
import { Model } from '../database/modelRepository';
import GroupedModelList from '../components/model-hub/GroupedModelList';
import { CustomKeyboardAvoidingView } from '../components/CustomKeyboardAvoidingView';

const ModelHubScreen = () => {
  useDefaultHeader();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const addModelSheetRef = useRef<BottomSheetModal | null>(null);
  const memoryWarningSheetRef = useRef<BottomSheetModal<Model> | null>(null);
  const { models, downloadStates } = useModelStore();
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['featured'])
  );
  const [groupByModel, setGroupByModel] = useState(false);

  const { groupedModels, isEmpty } = useModelHubData({
    models,
    downloadStates,
    search,
    activeFilters,
    groupByModel,
  });

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);
    newFilters.has(filter) ? newFilters.delete(filter) : newFilters.add(filter);
    setActiveFilters(newFilters);
  };

  const handleModelPress = useCallback((model: Model) => {
    modelManagementSheetRef.current?.present(model);
  }, []);

  const renderEmptyState = () => (
    <View style={styles.noModelsContainer}>
      <View style={styles.emptyIconWrapper}>
        <QuestionIcon
          width={12}
          height={21.33}
          style={{ color: theme.text.primary }}
        />
      </View>
      <View style={styles.emptyTextContainer}>
        <Text style={styles.emptyTitle}>No models found</Text>
        <Text style={styles.emptySubtitle}>
          Adjust your search or add new model.
        </Text>
      </View>
      <SecondaryButton text="Clear Search" onPress={() => setSearch('')} />
    </View>
  );

  return (
    <CustomKeyboardAvoidingView style={styles.keyboardAvoidingView}>
      <WithDrawerGesture>
        <View style={styles.container}>
          <View style={styles.horizontalInset}>
            <TextFieldInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search Models..."
              icon={
                <SearchIcon
                  width={20}
                  height={20}
                  style={{ color: theme.text.primary }}
                />
              }
            />
          </View>
          <View>
            <ScrollView
              horizontal
              contentContainerStyle={[
                styles.tagContainer,
                styles.horizontalInset,
              ]}
              showsHorizontalScrollIndicator={false}
            >
              <SortingTag
                text="Featured"
                selected={activeFilters.has('featured')}
                onPress={() => toggleFilter('featured')}
              />
              <SortingTag
                text="Group by model"
                selected={groupByModel}
                onPress={() => setGroupByModel(!groupByModel)}
              />
            </ScrollView>
          </View>
          {isEmpty ? (
            renderEmptyState()
          ) : (
            <GroupedModelList
              groupedModels={groupedModels}
              onModelPress={handleModelPress}
              memoryWarningSheetRef={memoryWarningSheetRef}
              contentContainerStyle={[
                styles.modelScrollContent,
                styles.horizontalInset,
              ]}
            />
          )}
          <FloatingActionButton
            onPress={() => addModelSheetRef.current?.present()}
          />
        </View>
      </WithDrawerGesture>
      <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
      <AddModelSheet bottomSheetModalRef={addModelSheetRef} />
      <MemoryWarningSheet bottomSheetModalRef={memoryWarningSheetRef} />
    </CustomKeyboardAvoidingView>
  );
};

export default ModelHubScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      gap: 24,
      paddingTop: 16,
    },
    horizontalInset: {
      paddingHorizontal: 16,
    },
    noModelsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 24,
      padding: 16,
    },
    emptyIconWrapper: {
      backgroundColor: theme.bg.softSecondary,
      width: 64,
      height: 64,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 9999,
    },
    emptyTextContainer: {
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      color: theme.text.primary,
    },
    emptySubtitle: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
    },
    modelScrollContent: {
      // 56 is the FAB size
      paddingBottom: theme.insets.bottom + 16 + 56,
    },
    tagContainer: {
      gap: 8,
      alignItems: 'center',
    },
  });
