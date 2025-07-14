import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { ModelState, useModelStore } from '../store/modelStore';
import ModelCard from '../components/model-hub/ModelCard';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import ModelManagementSheet from '../components/bottomSheets/ModelManagementSheet';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import TextFieldInput from '../components/TextFieldInput';
import SearchIcon from '../assets/icons/search.svg';
import SecondaryButton from '../components/SecondaryButton';
import QuestionIcon from '../assets/icons/question.svg';
import AddModelSheet from '../components/bottomSheets/AddModelSheet';
import MemoryWarningSheet from '../components/bottomSheets/MemoryWarningSheet';
import SortingTag from '../components/model-hub/SortingTag';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

const ModelHubScreen = () => {
  useDefaultHeader();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const addModelSheetRef = useRef<BottomSheetModal | null>(null);
  const memoryWarningSheetRef = useRef<BottomSheetModal | null>(null);

  const { models, downloadStates } = useModelStore();

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(['featured'])
  );
  const [groupByModel, setGroupByModel] = useState(false);

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);
    newFilters.has(filter) ? newFilters.delete(filter) : newFilters.add(filter);
    setActiveFilters(newFilters);
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.modelName
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesFilter =
      activeFilters.has('featured') && model.source === 'built-in'
        ? model.featured
        : true;

    return matchesSearch && matchesFilter;
  });

  const downloadedModels = filteredModels.filter((m) => m.isDownloaded);
  const availableModels = filteredModels.filter((m) => !m.isDownloaded);

  availableModels.sort((a, b) => {
    const aState = downloadStates[a.id]?.status;
    const bState = downloadStates[b.id]?.status;
    if (aState === ModelState.Downloading && bState !== ModelState.Downloading)
      return -1;
    if (bState === ModelState.Downloading && aState !== ModelState.Downloading)
      return 1;

    if (a.parameters !== b.parameters && a.parameters && b.parameters) {
      return a.parameters! - b.parameters;
    }

    return a.modelName.localeCompare(b.modelName);
  });

  const groupModelsByPrefix = (models: typeof filteredModels) => {
    return models.reduce<Record<string, typeof filteredModels>>(
      (acc, model) => {
        const prefix = model.modelName.split('-')[0].toLowerCase();
        if (!acc[prefix]) acc[prefix] = [];
        acc[prefix].push(model);
        return acc;
      },
      {}
    );
  };

  const renderGroupedModels = (models: typeof filteredModels) => {
    const grouped = groupModelsByPrefix(models);
    return (
      <>
        {Object.entries(grouped).map(([prefix, group]) => (
          <React.Fragment key={prefix}>
            <Text style={styles.sectionHeader}>{prefix}</Text>
            <View style={styles.modelList}>
              {group.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onPress={() =>
                    modelManagementSheetRef.current?.present(model)
                  }
                />
              ))}
            </View>
          </React.Fragment>
        ))}
      </>
    );
  };

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
    <>
      <WithDrawerGesture>
        <View style={styles.container}>
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
          <View>
            <ScrollView
              horizontal
              contentContainerStyle={styles.tagContainer}
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
          {filteredModels.length === 0 ? (
            renderEmptyState()
          ) : (
            <ScrollView contentContainerStyle={styles.modelScrollContent}>
              {groupByModel ? (
                renderGroupedModels([...downloadedModels, ...availableModels])
              ) : (
                <>
                  {downloadedModels.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Ready to Use</Text>
                      <View style={styles.modelList}>
                        {downloadedModels.map((model) => (
                          <ModelCard
                            key={model.id}
                            model={model}
                            bottomSheetModalRef={memoryWarningSheetRef}
                            onPress={() =>
                              modelManagementSheetRef.current?.present(model)
                            }
                          />
                        ))}
                      </View>
                    </>
                  )}
                  <Text style={styles.sectionHeader}>
                    Available to Download
                  </Text>
                  <View style={styles.downloadList}>
                    {availableModels.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        bottomSheetModalRef={memoryWarningSheetRef}
                        onPress={() =>
                          modelManagementSheetRef.current?.present(model)
                        }
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          )}
          <FloatingActionButton
            onPress={() => addModelSheetRef.current?.present()}
          />
        </View>
      </WithDrawerGesture>
      <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
      <AddModelSheet bottomSheetModalRef={addModelSheetRef} />
      <MemoryWarningSheet bottomSheetModalRef={memoryWarningSheetRef} />
    </>
  );
};

export default ModelHubScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: 16,
      padding: 16,
      backgroundColor: theme.bg.softPrimary,
    },
    noModelsContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 24,
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
    sectionHeader: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
      textTransform: 'capitalize',
    },
    modelList: {
      gap: 8,
    },
    downloadList: {
      gap: 8,
      paddingBottom: 60,
    },
    modelScrollContent: {
      gap: 16,
    },
    tagContainer: {
      gap: 8,
      alignItems: 'center',
      paddingVertical: 8,
      paddingRight: 8,
    },
  });
