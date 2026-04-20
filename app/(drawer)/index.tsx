import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { configureReanimatedLogger } from 'react-native-reanimated';
import NewChatHeaderButton from '../../components/NewChatHeaderButton';
import { Model } from '../../database/modelRepository';
import { getNextChatId, importMessages } from '../../database/chatRepository';
import { useSQLiteContext } from 'expo-sqlite';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { View, Image, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from '../../components/PrimaryButton';
import TextButton from '../../components/TextButton';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { importChatRoom } from '../../database/exportImportRepository';
import { useChatStore } from '../../store/chatStore';
import ModelSelectSheet from '../../components/bottomSheets/ModelSelectSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../../store/modelStore';
import { useSourceStore } from '../../store/sourceStore';
import { useLLMStore } from '../../store/llmStore';
import useOnboardingRedirect from '../../hooks/useOnboardingRedirect';
import WhatsNewCard from '../../components/WhatsNewCard';
import {
  getLastUsedModelId,
  setLastUsedModelId,
} from '../../utils/lastUsedModel';

export default function App() {
  useOnboardingRedirect();

  const navigation = useNavigation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { loadModels, downloadedModels } = useModelStore();
  const { loadSources } = useSourceStore();
  const db = useSQLiteContext();
  useDefaultHeader();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NewChatHeaderButton noOp />,
    });
  }, [navigation]);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addChat, initPhantomChat } = useChatStore();
  const { setActiveChatId } = useLLMStore();

  configureReanimatedLogger({
    strict: false,
  });

  const handleSetModel = async (model: Model, replace = false) => {
    bottomSheetModalRef.current?.dismiss();
    const nextChatId = await getNextChatId(db);
    await initPhantomChat(nextChatId, model);
    await setActiveChatId(null);
    await setLastUsedModelId(model.id);
    const target = {
      pathname: `/chat/${nextChatId}`,
      params: { modelId: model.id },
    } as const;
    if (replace) {
      router.replace(target);
    } else {
      router.push(target);
    }
  };

  const handleImport = async () => {
    const importedChat = await importChatRoom();
    if (importedChat) {
      try {
        const newChatId = await addChat(importedChat.title, -1);
        if (newChatId) {
          await importMessages(db!, newChatId, importedChat.messages);
          router.replace(`/chat/${newChatId}`);
        }
      } catch (error) {
        console.error('Error importing chat:', error);
        Alert.alert('Error', 'Failed to import chat. Please try again.');
      }
    }
  };

  useEffect(() => {
    loadModels();
    loadSources();
  }, [loadModels, loadSources]);

  useFocusEffect(
    useCallback(() => {
      if (downloadedModels.length === 0) return;
      (async () => {
        const lastId = await getLastUsedModelId();
        const model =
          downloadedModels.find((m) => m.id === lastId) ?? downloadedModels[0];
        handleSetModel(model, true);
      })();
    }, [downloadedModels])
  );

  const willRedirect = downloadedModels.length > 0;

  return (
    <>
      <LinearGradient
        colors={[theme.bg.softPrimary, theme.bg.main]}
        style={styles.container}
      >
        {!willRedirect && (
          <View style={styles.emptyContainer}>
            <Image
              source={require('../../assets/icons/icon.png')}
              style={styles.icon}
            />
            <WhatsNewCard />
            <View style={styles.buttonGroup}>
              <PrimaryButton
                text="Choose a model"
                onPress={() => {
                  bottomSheetModalRef.current?.present();
                }}
              />
              <TextButton
                text="Import chat"
                onPress={handleImport}
                style={styles.flatButton}
              />
            </View>
          </View>
        )}
      </LinearGradient>
      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        selectModel={handleSetModel}
      />
    </>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingBottom: 16 + theme.insets.bottom,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 64,
      gap: 24,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 12,
    },
    buttonGroup: {
      gap: 8,
      width: '100%',
    },
    flatButton: {
      borderWidth: 0,
    },
  });
