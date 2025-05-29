import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { useDefaultHeader } from '../hooks/useDefaultHeader';
import { useModelStore } from '../store/modelStore';
import ColorPalette from '../colors';
import ModelCard from '../components/model-hub/ModelCard';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import { Model } from '../database/modelRepository';

const ModelHubScreen = () => {
  useDefaultHeader();
  const { models } = useModelStore();

  const groupedModels = useMemo(() => {
    const groups: Record<string, typeof models> = {};
    models.forEach((model) => {
      const group = model.id.split(' ')[0];
      if (!groups[group]) groups[group] = [];
      groups[group].push(model);
    });
    return groups;
  }, [models]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const renderGroup = (groupName: string, models: Model[]) => {
    const isExpanded = expandedGroups[groupName];

    return (
      <View key={groupName} style={styles.groupContainer}>
        <Pressable
          onPress={() => toggleGroup(groupName)}
          style={styles.groupHeader}
        >
          <Text style={styles.groupTitle}>{groupName}</Text>
          <Text style={styles.chevron}>{isExpanded ? '⌄' : '›'}</Text>
        </Pressable>

        {isExpanded &&
          models.map((model) => <ModelCard key={model.id} model={model} />)}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Available Models</Text>

      <FlatList
        data={Object.keys(groupedModels)}
        keyExtractor={(item) => item}
        renderItem={({ item }) => renderGroup(item, groupedModels[item])}
        contentContainerStyle={{ paddingBottom: 120 }}
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
    color: ColorPalette.primary,
    marginBottom: 16,
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: ColorPalette.blueLight,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: ColorPalette.primary,
  },
  chevron: {
    fontSize: 18,
    color: ColorPalette.primary,
  },
});
