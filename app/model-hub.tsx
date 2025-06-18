import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useModelStore } from '../store/modelStore';
import ModelCard from '../components/model-hub/ModelCard';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import ModelManagementSheet from '../components/bottomSheets/ModelManagementSheet';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import TextFieldInput from '../components/TextFieldInput';
import SearchIcon from '../assets/icons/search.svg';
import { useTheme } from '../context/ThemeContext';
import SortingTag from '../components/model-hub/SortingTag';
import SecondaryButton from '../components/SecondaryButton';
import QuestionIcon from '../assets/icons/question.svg';
import AddModelSheet from '../components/bottomSheets/AddModelSheet';
import MemoryWarningSheet from '../components/bottomSheets/MemoryWarningSheet';

const ModelHubScreen = () => {
  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const addModelSheetRef = useRef<BottomSheetModal | null>(null);
  const memoryWarningSheet = useRef<BottomSheetModal | null>(null);
  const { models } = useModelStore();
  const { theme } = useTheme();

  useDefaultHeader();

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [groupByModel, setGroupByModel] = useState(false);

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

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    setActiveFilters(newFilters);
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.modelName
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesFilter =
      activeFilters.size === 0 || activeFilters.has(model.source);

    return matchesSearch && matchesFilter;
  });

  const downloadedModels = filteredModels.filter((m) => m.isDownloaded === 1);
  const availableModels = filteredModels.filter((m) => m.isDownloaded !== 1);

  const renderGroupedModels = (models: typeof filteredModels) => {
    const grouped = groupModelsByPrefix(models);
    return (
      <>
        {Object.entries(grouped).map(([prefix, group]) => (
          <React.Fragment key={prefix}>
            <Text
              style={[
                styles.sectionHeader,
                {
                  color: theme.text.defaultSecondary,
                  textTransform: 'capitalize',
                },
              ]}
            >
              {prefix}
            </Text>
            <View style={{ gap: 8 }}>
              {group.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  onPress={() => {
                    modelManagementSheetRef.current?.present(model);
                  }}
                />
              ))}
            </View>
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <>
      <WithDrawerGesture>
        <View
          style={{ ...styles.container, backgroundColor: theme.bg.softPrimary }}
        >
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
              horizontal={true}
              contentContainerStyle={{ gap: 8 }}
              showsHorizontalScrollIndicator={false}
            >
              <SortingTag
                text="Group by model"
                selected={groupByModel}
                onPress={() => setGroupByModel(!groupByModel)}
              />
              <SortingTag
                text="Built-in"
                selected={activeFilters.has('built-in')}
                onPress={() => toggleFilter('built-in')}
              />
              <SortingTag
                text="Remote"
                selected={activeFilters.has('remote')}
                onPress={() => toggleFilter('remote')}
              />
              <SortingTag
                text="Local"
                selected={activeFilters.has('local')}
                onPress={() => toggleFilter('local')}
              />
            </ScrollView>
          </View>
          {downloadedModels.length + availableModels.length === 0 ? (
            <View style={styles.noModelsContainer}>
              <View
                style={{
                  backgroundColor: theme.bg.softSecondary,
                  width: 64,
                  height: 64,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 9999,
                }}
              >
                <QuestionIcon
                  width={12}
                  height={21.33}
                  style={{ color: theme.text.primary }}
                />
              </View>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontFamily: fontFamily.medium,
                    fontSize: fontSizes.lg,
                    color: theme.text.primary,
                  }}
                >
                  No models found
                </Text>
                <Text
                  style={{
                    color: theme.text.defaultTertiary,
                    fontFamily: fontFamily.regular,
                    fontSize: fontSizes.sm,
                  }}
                >
                  Adjust your search, filters or add new model.
                </Text>
              </View>
              <SecondaryButton
                text="Clear Filters"
                onPress={() => {
                  setSearch('');
                  setActiveFilters(new Set());
                }}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {groupByModel ? (
                <>
                  {renderGroupedModels([
                    ...downloadedModels,
                    ...availableModels,
                  ])}
                </>
              ) : (
                <>
                  {downloadedModels.length > 0 && (
                    <>
                      <Text
                        style={[
                          styles.sectionHeader,
                          { color: theme.text.defaultSecondary },
                        ]}
                      >
                        Ready to Use
                      </Text>
                      <View style={{ gap: 8 }}>
                        {downloadedModels.map((model) => (
                          <ModelCard
                            key={model.id}
                            model={model}
                            onPress={() => {
                              modelManagementSheetRef.current?.present(model);
                            }}
                          />
                        ))}
                      </View>
                    </>
                  )}
                  <Text
                    style={[
                      styles.sectionHeader,
                      { color: theme.text.defaultSecondary },
                    ]}
                  >
                    Available to Download
                  </Text>
                  <View style={{ gap: 8, paddingBottom: 60 }}>
                    {availableModels.map((model) => (
                      <ModelCard
                        key={model.id}
                        model={model}
                        bottomSheetModalRef={memoryWarningSheet}
                        onPress={() => {
                          modelManagementSheetRef.current?.present(model);
                        }}
                      />
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          )}
          <FloatingActionButton
            onPress={() => {
              addModelSheetRef.current?.present();
            }}
          />
        </View>
      </WithDrawerGesture>

      <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
      <AddModelSheet bottomSheetModalRef={addModelSheetRef} />
      <MemoryWarningSheet bottomSheetModalRef={memoryWarningSheet} />
    </>
  );
};

export default ModelHubScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 16,
    padding: 16,
    backgroundColor: '#fff',
  },
  noModelsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  sectionHeader: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.medium,
  },
  tagContainer: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
  },
});
