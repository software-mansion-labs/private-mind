import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { useModelStore } from '../../store/modelStore';
import FloatingActionButton from '../../components/model-hub/FloatingActionButton';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import AddModelSheet from '../../components/bottomSheets/AddModelSheet';
import WarningSheet, {
  WarningSheetData,
} from '../../components/bottomSheets/WarningSheet';
import ModelManagementSheet from '../../components/bottomSheets/ModelManagementSheet';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Model } from '../../database/modelRepository';
import TextFieldInput from '../../components/TextFieldInput';
import SearchIcon from '../../assets/icons/search.svg';
import QuestionIcon from '../../assets/icons/question.svg';
import SecondaryButton from '../../components/SecondaryButton';
import ModelHubTabs, {
  ModelHubTab,
} from '../../components/model-hub/ModelHubTabs';
import FamilyCard from '../../components/model-hub/FamilyCard';
import ModelCard from '../../components/model-hub/ModelCard';
import {
  groupModelsByFamily,
  ModelFamily,
} from '../../utils/modelFamily';
import { CustomKeyboardAvoidingView } from '../../components/CustomKeyboardAvoidingView';

const ModelHubScreen = () => {
  useDefaultHeader();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const addModelSheetRef = useRef<BottomSheetModal | null>(null);
  const wifiWarningSheetRef = useRef<BottomSheetModal<WarningSheetData> | null>(
    null
  );
  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);

  const { models } = useModelStore();
  const [tab, setTab] = useState<ModelHubTab>('featured');
  const [search, setSearch] = useState('');

  const { families, mineModels } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (m: Model) =>
      !q || m.modelName.toLowerCase().includes(q);

    if (tab === 'mine') {
      const mine = models
        .filter((m) => m.source !== 'built-in')
        .filter(matchesSearch);
      return { families: [] as ModelFamily[], mineModels: mine };
    }

    const builtIns = models.filter((m) => m.source === 'built-in');
    const filtered =
      tab === 'experimental'
        ? builtIns.filter((m) => m.experimental)
        : builtIns.filter((m) => !m.experimental);

    const familyList = groupModelsByFamily(filtered)
      .map((fam) => ({
        ...fam,
        models: fam.models.filter(matchesSearch),
      }))
      .filter((fam) => (q ? fam.models.length > 0 : true))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { families: familyList, mineModels: [] };
  }, [models, tab, search]);

  const openFamily = (family: ModelFamily) => {
    router.push(`/model-family/${encodeURIComponent(family.name)}`);
  };

  const isEmpty =
    tab === 'mine' ? mineModels.length === 0 : families.length === 0;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <QuestionIcon
          width={12}
          height={21.33}
          style={{ color: theme.text.primary }}
        />
      </View>
      <View style={styles.emptyTextContainer}>
        <Text style={styles.emptyTitle}>
          {tab === 'mine' ? 'No custom models yet' : 'No models found'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {tab === 'mine'
            ? 'Add a remote or local model with the + button.'
            : 'Adjust your search or switch tabs.'}
        </Text>
      </View>
      {search.length > 0 && (
        <SecondaryButton text="Clear Search" onPress={() => setSearch('')} />
      )}
    </View>
  );

  return (
    <CustomKeyboardAvoidingView style={styles.keyboardAvoidingView}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ModelHubTabs value={tab} onChange={setTab} />
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

        {isEmpty ? (
          renderEmptyState()
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {tab === 'mine'
              ? mineModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    compactView={false}
                    onPress={() =>
                      modelManagementSheetRef.current?.present(model)
                    }
                    wifiWarningSheetRef={wifiWarningSheetRef}
                  />
                ))
              : families.map((family) => (
                  <FamilyCard
                    key={family.name}
                    family={family}
                    onPress={openFamily}
                  />
                ))}
          </ScrollView>
        )}

        <FloatingActionButton
          onPress={() => addModelSheetRef.current?.present()}
        />
      </View>
      <AddModelSheet bottomSheetModalRef={addModelSheetRef} />
      <WarningSheet bottomSheetModalRef={wifiWarningSheetRef} />
      <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
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
      paddingTop: 16,
    },
    header: {
      gap: 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    scrollContent: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16 + 56,
    },
    emptyContainer: {
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
      textAlign: 'center',
    },
  });
