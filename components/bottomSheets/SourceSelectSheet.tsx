import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import {
  View,
  StyleSheet,
  Text,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import SearchIcon from '../../assets/icons/search.svg';
import TextInputBorder from '../TextInputBorder';
import {
  getSourcesEnabledInChat,
  Source,
} from '../../database/sourcesRepository';
import SourceCard from '../sources/SourceCard';
import UploadIcon from '../../assets/icons/upload.svg';
import SecondaryButton from '../SecondaryButton';
import TextButton from '../TextButton';
import { useSourceStore } from '../../store/sourceStore';
import { useChatStore } from '../../store/chatStore';
import { useSQLiteContext } from 'expo-sqlite';
import * as DocumentPicker from 'expo-document-picker';
import { useVectorStore } from '../../context/VectorStoreContext';
import ActivatedSourceCard from '../sources/ActivatedSourceCard';
import PlusIcon from '../../assets/icons/plus.svg';
import { useLLMStore } from '../../store/llmStore';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  chatId: number | null;
  onSourcesChanged: (count: number) => void;
}

const SourceSelectSheet = ({
  bottomSheetModalRef,
  chatId,
  onSourcesChanged,
}: Props) => {
  const { theme } = useTheme();
  const { sources, addSource } = useSourceStore();
  const { enableSource } = useChatStore();
  const { sendEventMessage } = useLLMStore();
  const { vectorStore } = useVectorStore();
  const db = useSQLiteContext();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [search, setSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [deactivatedSources, setDeactivatedSources] = useState<Source[]>([]);

  const filteredSources = deactivatedSources.filter((source) =>
    source.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const loadSources = async () => {
      if (chatId) {
        const enabledSources = await getSourcesEnabledInChat(db, chatId);
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
  }, [chatId, sources]);

  const uploadSource = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri || '';
      const newSource: Omit<Source, 'id'> = {
        name:
          asset.name.split('.')[0] ||
          asset.uri.split('/').pop()?.split('.')[0] ||
          'Unnamed',
        type: asset.uri.split('.').pop() || '',
        size: asset.size || null,
      };

      await addSource(newSource, uri, vectorStore!);
    }
  };

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

  const insets = useSafeAreaInsets();

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
      onSourcesChanged(updatedActiveSources.length);
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
          {activeSources.length > 0 && (
            <View style={[{ gap: 24, maxHeight: 170 }]}>
              <View
                style={[
                  {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  },
                  styles.horizontalInset,
                ]}
              >
                <Text style={[styles.title]}>Files used in this chat</Text>
                <View
                  style={{
                    borderRadius: 9999,
                    width: 24,
                    height: 24,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: theme.bg.main,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSizes.sm,
                      fontFamily: fontFamily.medium,
                      color: theme.text.contrastPrimary,
                    }}
                  >
                    {activeSources.length}
                  </Text>
                </View>
              </View>
              <BottomSheetFlatList
                data={activeSources}
                keyExtractor={(item) => item.id.toString()}
                // only frist two styles appear to be forwarded, so the array is
                // nested to make all styles be part of the first item
                contentContainerStyle={[
                  [styles.modelList, styles.horizontalInset],
                ]}
                renderItem={({ item }) => <ActivatedSourceCard source={item} />}
              />
            </View>
          )}
          <Text style={[styles.title, styles.horizontalInset]}>
            Select source files
          </Text>
          {Platform.OS === 'ios' && (
            <View style={styles.horizontalInset}>
              <View style={styles.inputWrapper}>
                <TextInputBorder active={searchActive} />
                <SearchIcon width={20} height={20} style={styles.searchIcon} />
                <BottomSheetTextInput
                  style={styles.input}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search source files..."
                  placeholderTextColor={theme.text.defaultTertiary}
                  onFocus={() => setSearchActive(true)}
                  onBlur={() => setSearchActive(false)}
                />
              </View>
            </View>
          )}
          <BottomSheetFlatList
            data={filteredSources}
            keyExtractor={(item) => item.id.toString()}
            // only frist two styles appear to be forwarded, so the array is
            // nested to make all styles be part of the first item
            contentContainerStyle={[[styles.modelList, styles.horizontalInset]]}
            renderItem={({ item }) => (
              <SourceCard
                source={item}
                actionButton={
                  <TouchableOpacity
                    onPress={() => {
                      handleSourceToggle(item);
                    }}
                    hitSlop={15}
                    style={{
                      borderRadius: 9999,
                      backgroundColor: theme.bg.main,
                      padding: 8,
                      width: 36,
                      height: 36,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <PlusIcon
                      style={{ color: theme.text.contrastPrimary }}
                      width={18}
                      height={18}
                    />
                  </TouchableOpacity>
                }
              />
            )}
          />
          <View
            style={[
              styles.horizontalInset,
              { paddingBottom: insets.bottom + 16, gap: 8 },
            ]}
          >
            <SecondaryButton
              icon={
                <UploadIcon
                  style={{ color: theme.text.primary }}
                  width={16}
                  height={16}
                />
              }
              text="Upload source files"
              onPress={async () => {
                await uploadSource();
              }}
            />
            <TextButton
              text="Manage reference documents"
              style={{ borderWidth: 0 }}
              onPress={() => {
                bottomSheetModalRef.current?.dismiss();
                router.push('/sources');
              }}
            />
          </View>
        </View>
      ) : (
        <BottomSheetView style={[styles.content, styles.horizontalInset]}>
          <View style={{ paddingBottom: 16 + insets.bottom, gap: 24 }}>
            <Text style={styles.title}>Use source files</Text>
            <Text style={styles.subText}>
              Add text documents the model will use to extend the knowledge used
              for responses.
            </Text>
            <PrimaryButton
              text="Upload source files"
              icon={
                <UploadIcon
                  style={{ color: theme.text.contrastPrimary }}
                  width={16}
                  height={16}
                />
              }
              onPress={async () => {
                await uploadSource();
              }}
            />
          </View>
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
    horizontalInset: {
      paddingHorizontal: 16,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    inputWrapper: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      width: '90%',
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
      lineHeight: 22,
    },
    searchIcon: {
      color: theme.text.primary,
    },
    modelList: {
      gap: 8,
    },
  });
