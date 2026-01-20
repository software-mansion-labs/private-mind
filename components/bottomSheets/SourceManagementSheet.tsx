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
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import EntryButton from '../EntryButton';
import EditIcon from '../../assets/icons/edit.svg';
import CrossCircleIcon from '../../assets/icons/cross-circle.svg';
import Toast from 'react-native-toast-message';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import SourceCard from '../sources/SourceCard';
import { Source } from '../../database/sourcesRepository';
import { useSQLiteContext } from 'expo-sqlite';
import TextInputBorder from '../TextInputBorder';
import { useSourceStore } from '../../store/sourceStore';
import { useChatStore } from '../../store/chatStore';
import { useVectorStore } from '../../context/VectorStoreContext';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

enum SourceStage {
  Initial,
  RemoveFile,
  RenameSource,
}

const SheetContent = ({
  source,
  bottomSheetModalRef,
}: {
  source: Source;
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}) => {
  const { theme } = useTheme();
  const { deleteSource, renameSource } = useSourceStore();
  const { loadChats } = useChatStore();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const db = useSQLiteContext();
  const { vectorStore } = useVectorStore();

  const [stage, setStage] = useState<SourceStage>(SourceStage.Initial);
  const [name, setName] = useState(source.name);
  const [inputActive, setInputActive] = useState(false);

  useEffect(() => {
    setStage(SourceStage.Initial);
    setName(source.name);
  }, [source]);

  const handleSaveChanges = useCallback(async () => {
    await renameSource(source.id, name);
    Toast.show({
      type: 'defaultToast',
      text1: `Source file has been successfully renamed`,
    });
    bottomSheetModalRef.current?.dismiss();
  }, [db, name, source.id, bottomSheetModalRef]);

  const handleDeleteSource = useCallback(async () => {
    await deleteSource(source);
    await vectorStore?.delete({
      predicate: (value) => value.metadata?.documentId === source.id,
    });
    await loadChats();

    Toast.show({
      type: 'defaultToast',
      text1: `Source file has been successfully removed`,
    });
    bottomSheetModalRef.current?.dismiss();
  }, [db, source.id, bottomSheetModalRef]);

  switch (stage) {
    case SourceStage.RenameSource:
      return (
        <>
          <Text style={styles.title}>Rename source file</Text>
          <View style={styles.inputWrapper}>
            <TextInputBorder active={inputActive} />
            <BottomSheetTextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              onFocus={() => setInputActive(true)}
              onBlur={() => setInputActive(false)}
              autoFocus
            />
          </View>
          <View style={styles.buttonGroup}>
            <PrimaryButton text="Save changes" onPress={handleSaveChanges} />
            <SecondaryButton
              text="Cancel"
              onPress={() => setStage(SourceStage.Initial)}
            />
          </View>
        </>
      );

    case SourceStage.RemoveFile:
      return (
        <>
          <Text style={styles.title}>
            Are you sure you want remove this source file?
          </Text>
          <Text style={styles.subText}>
            It will be removed from the list and every chatroom that is using
            it.
          </Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              text={'Remove this file'}
              style={styles.buttonDestructive}
              onPress={handleDeleteSource}
            />
            <SecondaryButton
              text="Cancel"
              onPress={() => setStage(SourceStage.Initial)}
            />
          </View>
        </>
      );

    case SourceStage.Initial:
    default:
      return (
        <>
          <SourceCard source={source} />
          <View style={styles.buttonGroup}>
            <EntryButton
              text="Rename file"
              icon={
                <EditIcon width={18} height={20} style={styles.iconPrimary} />
              }
              onPress={() => setStage(SourceStage.RenameSource)}
            />
            <EntryButton
              text="Remove file"
              textStyle={styles.textError}
              icon={
                <CrossCircleIcon
                  width={18}
                  height={19}
                  style={styles.iconError}
                />
              }
              onPress={() => setStage(SourceStage.RemoveFile)}
            />
          </View>
        </>
      );
  }
};

const SourceManagementSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior="restore"
    >
      {(props) => (
        <BottomSheetView style={styles.container}>
          <SheetContent
            source={props.data}
            bottomSheetModalRef={bottomSheetModalRef}
          />
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default SourceManagementSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 24,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
      gap: 24,
      backgroundColor: theme.bg.softPrimary,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
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
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    buttonGroup: {
      gap: 8,
    },
    textError: {
      color: theme.text.error,
    },
    iconPrimary: {
      color: theme.text.primary,
    },
    iconImportant: {
      color: theme.bg.strongPrimary,
    },
    iconError: {
      color: theme.text.error,
    },
    buttonDestructive: {
      backgroundColor: theme.bg.errorPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handle: {
      borderRadius: 16,
      backgroundColor: theme.bg.softPrimary,
    },
    handleIndicator: {
      backgroundColor: theme.text.primary,
      width: 64,
      height: 4,
      borderRadius: 20,
    },
    background: {
      backgroundColor: theme.bg.softPrimary,
    },
  });
