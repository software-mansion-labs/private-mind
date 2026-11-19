import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { configureReanimatedLogger } from 'react-native-reanimated';
import NewChatHeaderButton from '../../components/NewChatHeaderButton';
import { useSQLiteContext } from 'expo-sqlite';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { StyleSheet, View } from 'react-native';
import { NewChatBackground } from '../../components/chat-screen/NewChatBackground';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useImportChat } from '../../hooks/useImportChat';
import { useModelStore } from '../../store/modelStore';
import { useModelUpdateSheetStore } from '../../store/modelUpdateSheetStore';
import { useSourceStore } from '../../store/sourceStore';
import useOnboardingRedirect from '../../hooks/useOnboardingRedirect';
import NoModelWelcome from '../../components/NoModelWelcome';

let coldStartRedirectPending = true;

configureReanimatedLogger({
  strict: false,
});

export default function App() {
  const onboardingRedirect = useOnboardingRedirect();

  const navigation = useNavigation();
  const { downloadedModels } = useModelStore();
  const { loadSources } = useSourceStore();
  const hasAutoRedirectedRef = useRef(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const db = useSQLiteContext();
  useDefaultHeader({ glass: true });

  const { styles } = useThemedStyles(createStyles);

  const openModels = useCallback(() => router.replace('/model-hub'), []);

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

  const onboardingRedirectRef = useRef(onboardingRedirect);
  onboardingRedirectRef.current = onboardingRedirect;
  const [isFocused, setIsFocused] = useState(false);
  const [returnedFromRedirect, setReturnedFromRedirect] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      if (onboardingRedirectRef.current === 'redirected') {
        setReturnedFromRedirect(true);
      }
      return () => setIsFocused(false);
    }, [])
  );
  const welcomeIsUncovered =
    onboardingRedirect === 'stayed' ||
    (onboardingRedirect === 'redirected' && returnedFromRedirect);

  const willRedirect = downloadedModels.length > 0 && !redirectFailed;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        willRedirect ? <NewChatHeaderButton noOp glass /> : null,
    });
  }, [navigation, willRedirect]);

  return (
    <>
      <View style={styles.container}>
        <NewChatBackground />
        {!willRedirect && (
          <NoModelWelcome
            onChooseModel={openModels}
            onImportChat={handleImport}
            playSwarm={isFocused && welcomeIsUncovered}
          />
        )}
      </View>
    </>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
  });
