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
import SecondaryButton from '../components/SecondaryButton';
import QuestionIcon from '../assets/icons/question.svg';
import AddModelSheet from '../components/bottomSheets/AddModelSheet';
import MemoryWarningSheet from '../components/bottomSheets/MemoryWarningSheet';

const ModelHubScreen = () => {
  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const addModelSheetRef = useRef<BottomSheetModal | null>(null);
  const memoryWarningSheetRef = useRef<BottomSheetModal | null>(null);
  const { models } = useModelStore();
  const { theme } = useTheme();

  useDefaultHeader();

  const [search, setSearch] = useState('');

  const filteredModels = models.filter((model) => {
    const matchesSearch = model.modelName
      .toLowerCase()
      .includes(search.toLowerCase());

    return matchesSearch;
  });

  const downloadedModels = filteredModels.filter((m) => m.isDownloaded);
  const availableModels = filteredModels.filter((m) => !m.isDownloaded);

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
                }}
              />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 16 }}>
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
                        bottomSheetModalRef={memoryWarningSheetRef}
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
                    bottomSheetModalRef={memoryWarningSheetRef}
                    onPress={() => {
                      modelManagementSheetRef.current?.present(model);
                    }}
                  />
                ))}
              </View>
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
      <MemoryWarningSheet bottomSheetModalRef={memoryWarningSheetRef} />
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
