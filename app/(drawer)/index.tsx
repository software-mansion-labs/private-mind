import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { useFocusEffect, useNavigation } from 'expo-router';
import { configureReanimatedLogger } from 'react-native-reanimated';
import NewChatHeaderButton from '../../components/NewChatHeaderButton';
import { Model } from '../../database/modelRepository';
import { useSQLiteContext } from 'expo-sqlite';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useImportChat } from '../../hooks/useImportChat';
import ModelSelectSheet from '../../components/bottomSheets/ModelSelectSheet';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../../store/modelStore';
import { useModelUpdateSheetStore } from '../../store/modelUpdateSheetStore';
import { useSourceStore } from '../../store/sourceStore';
import useOnboardingRedirect from '../../hooks/useOnboardingRedirect';
import { setLastUsedModelId } from '../../utils/lastUsedModel';
import { useModelSwitch } from '../../components/chat-screen/useModelSwitch';
import NoModelWelcome from '../../components/NoModelWelcome';

let coldStartRedirectPending = true;

configureReanimatedLogger({
  strict: false,
});

export default function App() {
  useOnboardingRedirect();

  const navigation = useNavigation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { downloadedModels } = useModelStore();
  const { loadSources } = useSourceStore();
  const hasAutoRedirectedRef = useRef(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const db = useSQLiteContext();
  useDefaultHeader({ glass: true });

  const { styles, theme } = useThemedStyles(createStyles);

  const handleSetModel = async (model: Model, replace = false) => {
    await setLastUsedModelId(model.id);
    await startPhantomChat(db, replace ? 'replace' : 'push', model);
    return true;
  };

  const { pickModel, handleSheetStateChange } = useModelSwitch(handleSetModel);

  const handleImport = useImportChat();

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
          const mode = coldStartRedirectPending
            ? 'replace-immediately'
            : 'replace';
          coldStartRedirectPending = false;
          useModelUpdateSheetStore.getState().enterNewChat();
          await startPhantomChat(db, mode);
        } catch (error) {
          console.error(
            'Failed to open a chat for the downloaded model',
            error
          );
          setRedirectFailed(true);
        } finally {
          // Reset so this screen can redirect again on a future focus cycle
          // (e.g. user navigates back to / from a chat).
          hasAutoRedirectedRef.current = false;
        }
      })();
    }, [db, downloadedModels])
  );

  const willRedirect = downloadedModels.length > 0 && !redirectFailed;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        willRedirect ? <NewChatHeaderButton noOp glass /> : null,
    });
  }, [navigation, willRedirect]);

  return (
    <>
      <LinearGradient
        colors={[theme.bg.softPrimary, theme.bg.main]}
        style={styles.container}
      >
        {!willRedirect && (
          <NoModelWelcome
            onChooseModel={() => bottomSheetModalRef.current?.present()}
            onImportChat={handleImport}
          />
        )}
      </LinearGradient>
      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        onModelPicked={pickModel}
        onSheetStateChange={handleSheetStateChange}
      />
    </>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
  });
