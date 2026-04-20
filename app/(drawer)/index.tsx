import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { configureReanimatedLogger } from 'react-native-reanimated';
import NewChatHeaderButton from '../../components/NewChatHeaderButton';
import { Model } from '../../database/modelRepository';
import { importMessages } from '../../database/chatRepository';
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
import useOnboardingRedirect from '../../hooks/useOnboardingRedirect';
import WhatsNewCard from '../../components/WhatsNewCard';
import { setLastUsedModelId } from '../../utils/lastUsedModel';

export default function App() {
  useOnboardingRedirect();

  const navigation = useNavigation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { downloadedModels } = useModelStore();
  const { loadSources } = useSourceStore();
  const hasAutoRedirectedRef = useRef(false);
  const db = useSQLiteContext();
  useDefaultHeader();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NewChatHeaderButton noOp />,
    });
  }, [navigation]);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addChat } = useChatStore();

  configureReanimatedLogger({
    strict: false,
  });

  const handleSetModel = async (model: Model, replace = false) => {
    bottomSheetModalRef.current?.dismiss();
    await setLastUsedModelId(model.id);
    await startPhantomChat(db, replace ? 'replace' : 'push', model);
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
    loadSources();
  }, [loadSources]);

  useFocusEffect(
    useCallback(() => {
      if (downloadedModels.length === 0) return;
      if (hasAutoRedirectedRef.current) return;
      hasAutoRedirectedRef.current = true;
      (async () => {
        try {
          await startPhantomChat(db, 'replace');
        } finally {
          // Reset so this screen can redirect again on a future focus cycle
          // (e.g. user navigates back to / from a chat).
          hasAutoRedirectedRef.current = false;
        }
      })();
    }, [db, downloadedModels])
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
