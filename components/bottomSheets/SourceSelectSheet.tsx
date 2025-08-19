import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import {
  getSourcesEnabledInChat,
  Source,
} from '../../database/sourcesRepository';
import { useSourceStore } from '../../store/sourceStore';
import { useChatStore } from '../../store/chatStore';
import { useSQLiteContext } from 'expo-sqlite';
import { useLLMStore } from '../../store/llmStore';
import { useSourceUpload } from '../../hooks/useSourceUpload';
import ActiveSourcesSection from './source-select/ActiveSourcesSection';
import SourceListSection from './source-select/SourceListSection';
import EmptySourcesView from './source-select/EmptySourcesView';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  enabledSources: number[];
  chatId: number | null;
}

const SourceSelectSheet = ({
  bottomSheetModalRef,
  enabledSources,
  chatId,
}: Props) => {
  const { theme } = useTheme();
  const { sources } = useSourceStore();
  const { enableSource } = useChatStore();
  const { sendEventMessage } = useLLMStore();
  const db = useSQLiteContext();
  const { uploadSource } = useSourceUpload();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [search, setSearch] = useState('');
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [deactivatedSources, setDeactivatedSources] = useState<Source[]>([]);

  const filteredSources = deactivatedSources.filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase())
  );
  useEffect(() => {
    const loadSources = async () => {
      if (chatId) {
        const activeSources = sources.filter((source) =>
          enabledSources.includes(source.id)
        );
        const deactivatedSources = sources.filter(
          (source) => !enabledSources.includes(source.id)
        );
        setActiveSources(activeSources);
        setDeactivatedSources(deactivatedSources);
      }
    };

    loadSources();
  }, [chatId, enabledSources, sources]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
  );

  const handleSourceToggle = async (enabledSource: Source) => {
    if (chatId) {
      await enableSource(chatId, enabledSource.id);
      await sendEventMessage(
        chatId,
        `${enabledSource.name} has been added as a source file`
      );
      const updatedActiveSources = activeSources.some(
        (source) => source.id === enabledSource.id
      )
        ? activeSources.filter((source) => source.id !== enabledSource.id)
        : [
            ...activeSources,
            sources.find((source) => source.id === enabledSource.id)!,
          ];
      setActiveSources(updatedActiveSources);
      setDeactivatedSources((prev) =>
        prev.filter((source) => source.id !== enabledSource.id)
      );
    }
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      snapPoints={sources.length == 0 ? [] : ['90%']}
      enableDynamicSizing={sources.length == 0}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior="restore"
    >
      {sources.length > 0 ? (
        <View style={styles.content}>
          <ActiveSourcesSection activeSources={activeSources} />
          <SourceListSection
            filteredSources={filteredSources}
            search={search}
            onSearchChange={setSearch}
            onSourceToggle={handleSourceToggle}
            onUploadSource={uploadSource}
            onDismiss={() => bottomSheetModalRef.current?.dismiss()}
          />
        </View>
      ) : (
        <BottomSheetView style={[styles.content]}>
          <EmptySourcesView onUploadSource={uploadSource} />
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default SourceSelectSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    handle: {
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 16,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    background: {
      backgroundColor: theme.bg.softPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    content: {
      flex: 1,
      paddingTop: 16,
      gap: 24,
    },
  });
