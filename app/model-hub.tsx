import React, { useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useModelStore } from '../store/modelStore';
import ModelCard from '../components/model-hub/ModelCard';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import WithDrawerGesture from '../components/WithDrawerGesture';
import { FlatList, ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Model } from '../database/modelRepository';
import ModelManagementSheet from '../components/bottomSheets/ModelManagementSheet';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import TextFieldInput from '../components/TextFieldInput';
import SearchIcon from '../assets/icons/search.svg';
import { useTheme } from '../context/ThemeContext';
import SortingTag from '../components/model-hub/SortingTag';

const ModelHubScreen = () => {
  const bottomSheetModalRef = useRef<BottomSheetModal | null>(null);
  useDefaultHeader();
  const { theme } = useTheme();
  const { models } = useModelStore();
  const [search, setSearch] = useState('');

  const downloadedModels = models.filter((m) => m.isDownloaded === 1);
  const availableModels = models.filter((m) => m.isDownloaded !== 1);

  const openModal = (model: Model) => {
    bottomSheetModalRef.current?.present(model);
  };

  return (
    <>
      <WithDrawerGesture>
        <View style={styles.container}>
          <TextFieldInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search Models..."
            icon={<SearchIcon width={20} height={20} />}
          />

          <ScrollView
            horizontal={true}
            style={{ height: 110 }}
            contentContainerStyle={{ gap: 8 }}
          >
            <SortingTag
              text="Group by model"
              selected={false}
              onPress={() => {}}
            />
            <SortingTag text="Built-in" selected={false} onPress={() => {}} />
            <SortingTag text="Remote" selected={false} onPress={() => {}} />
            <SortingTag text="Local" selected={false} onPress={() => {}} />
          </ScrollView>
          {downloadedModels.length > 0 && (
            <>
              <Text
                style={{
                  ...styles.sectionHeader,
                  color: theme.text.defaultSecondary,
                }}
              >
                Ready to Use
              </Text>
              <FlatList
                data={downloadedModels}
                keyExtractor={(item) => item.id + '_downloaded'}
                renderItem={({ item }) => (
                  <ModelCard model={item} onPress={openModal} />
                )}
                contentContainerStyle={{
                  gap: 8,
                }}
                scrollEnabled={true}
              />
            </>
          )}

          <Text
            style={{
              ...styles.sectionHeader,
              color: theme.text.defaultSecondary,
            }}
          >
            Available to Download
          </Text>
          <FlatList
            data={availableModels}
            keyExtractor={(item) => item.id + '_available'}
            renderItem={({ item }) => (
              <ModelCard model={item} onPress={openModal} />
            )}
            contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          />

          <FloatingActionButton />
        </View>
      </WithDrawerGesture>

      <ModelManagementSheet bottomSheetModalRef={bottomSheetModalRef} />
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
  sectionHeader: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.medium,
    marginBottom: 8,
    marginTop: 16,
  },
});
