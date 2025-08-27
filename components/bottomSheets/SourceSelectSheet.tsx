import React, {
  RefObject,
  useCallback,
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
import { Source } from '../../database/sourcesRepository';
import { useSourceStore } from '../../store/sourceStore';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { useSourceUpload } from '../../hooks/useSourceUpload';
import WarningSheet from './WarningSheet';
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
  const { uploadSource, isReading, warningSheetRef } = useSourceUpload();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [search, setSearch] = useState('');

  const activeSources = sources.filter((source) =>
    enabledSources.includes(source.id)
  );
  const deactivatedSources = sources.filter(
    (source) => !enabledSources.includes(source.id)
  );
  const filteredSources = deactivatedSources.filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase())
  );

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
    }
  };

  return (
    <>
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
              isUploading={isReading}
            />
          </View>
        ) : (
          <BottomSheetView style={[styles.content]}>
            <EmptySourcesView onUploadSource={uploadSource} isUploading={isReading} />
          </BottomSheetView>
        )}
      </BottomSheetModal>
      <WarningSheet bottomSheetModalRef={warningSheetRef} />
    </>
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
