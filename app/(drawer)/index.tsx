import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigation, router } from 'expo-router';
import { useLayoutEffect } from 'react';
import SettingsHeaderButton from '../../components/SettingsHeaderButton';
import { configureReanimatedLogger } from 'react-native-reanimated';
import { Model } from '../../database/modelRepository';
import { getNextChatId, importMessages } from '../../database/chatRepository';
import { useSQLiteContext } from 'expo-sqlite';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { View, Image, Text, StyleSheet, Alert } from 'react-native';
import PrimaryButton from '../../components/PrimaryButton';
import TextButton from '../../components/TextButton';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { importChatRoom } from '../../database/exportImportRepository';
import { useChatStore } from '../../store/chatStore';
import ModelSelectSheet from '../../components/bottomSheets/ModelSelectSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../../store/modelStore';
import { useSourceStore } from '../../store/sourceStore';
import { useLLMStore } from '../../store/llmStore';

export default function App() {
  const navigation = useNavigation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { loadModels } = useModelStore();
  const { loadSources } = useSourceStore();
  const db = useSQLiteContext();
  useDefaultHeader();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addChat, initPhantomChat } = useChatStore();
  const { setActiveChatId } = useLLMStore();

  configureReanimatedLogger({
    strict: false,
  });

  const handleSetModel = async (model: Model) => {
    const nextChatId = await getNextChatId(db);
    await initPhantomChat(nextChatId);
    await setActiveChatId(null);
    router.push({
      pathname: `/chat/${nextChatId}`,
      params: { modelId: model.id },
    });
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <SettingsHeaderButton chatId={null} />,
    });
  }, [navigation]);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/icons/icon.png')}
            style={styles.icon}
          />
          <View style={styles.emptyTextContainer}>
            <Text style={styles.emptyMessageTitle}>
              Select a model to start chatting
            </Text>
            <Text style={styles.emptyMessage}>
              Use default models or upload custom ones from your local files or
              external URLs.
            </Text>
          </View>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              text="Open a models list"
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
      </View>
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
      backgroundColor: theme.bg.softPrimary,
      paddingBottom: 16 + theme.insets.bottom,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      gap: 24,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 12,
    },
    emptyTextContainer: {
      gap: 8,
    },
    emptyMessage: {
      textAlign: 'center',
      color: theme.text.defaultSecondary,
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      lineHeight: lineHeights.sm,
    },
    emptyMessageTitle: {
      textAlign: 'center',
      color: theme.text.primary,
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      lineHeight: lineHeights.lg,
    },
    buttonGroup: {
      gap: 8,
      width: '100%',
    },
    flatButton: {
      borderWidth: 0,
    },
  });
