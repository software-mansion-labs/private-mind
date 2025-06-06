import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useModelStore } from '../store/modelStore';
import ModelCard from '../components/model-hub/ModelCard';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';

const ModelHubScreen = () => {
  useDefaultHeader();
  const { models } = useModelStore();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Available Models</Text>

      <FlatList
        data={models}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ModelCard model={item} />}
        contentContainerStyle={{ gap: 8 }}
        showsVerticalScrollIndicator={false}
      />

      <FloatingActionButton />
    </View>
  );
};

export default ModelHubScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
  },
});
