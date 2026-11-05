import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import SheetBackdrop from './SheetBackdrop';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useUpdateNetworkCheck } from '../../hooks/useUpdateNetworkCheck';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { useModelStore } from '../../store/modelStore';
import { useModelUpdateSheetStore } from '../../store/modelUpdateSheetStore';
import {
  notYetConsented,
  pendingRetiredNotices,
  requiredUpdates,
  updateSizeGB,
} from '../../utils/modelUpdate';

const updatesToAsk = (resumed: boolean) => {
  const { models, retiredModels, updateConsent } = useModelStore.getState();
  const pending = requiredUpdates(models, retiredModels);
  return resumed ? notYetConsented(pending, updateConsent.modelNames) : pending;
};

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <SheetBackdrop {...props} />
);

const ModelUpdateSheet = () => {
  const { styles } = useThemedStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal>(null);
  const resumedRef = useRef<boolean | null>(null);
  const newChatEntries = useModelUpdateSheetStore(
    (state) => state.newChatEntries
  );
  const models = useModelStore((state) => state.models);
  const retiredModels = useModelStore((state) => state.retiredModels);
  const { canDownload, ConfirmElement } = useUpdateNetworkCheck();
  const [asked, setAsked] = useState(() => updatesToAsk(false));

  useEffect(() => {
    if (newChatEntries === 0) return;
    (async () => {
      if (resumedRef.current === null) {
        resumedRef.current = await useModelStore
          .getState()
          .resumeConsentedUpdates();
      }
      const toAsk = updatesToAsk(resumedRef.current);
      setAsked(toAsk);
      if (toAsk.length > 0) sheetRef.current?.present();
    })();
  }, [newChatEntries]);

  const notices = pendingRetiredNotices(retiredModels, models);

  const handleLater = () => sheetRef.current?.dismiss();

  const handleUpdate = async () => {
    sheetRef.current?.dismiss();
    const network = await canDownload(updateSizeGB(asked));
    if (!network) return;
    const store = useModelStore.getState();
    await store.rememberUpdateConsent(
      asked.map((model) => model.modelName),
      network === 'mobile-data'
    );
    resumedRef.current = true;
    store.updateOutdatedModels(asked);
  };

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.sheet}
          testID="model-update-sheet"
        >
          <Text style={styles.title}>{MODEL_UPDATE_TEXT.title}</Text>
          <Text style={styles.body}>
            {MODEL_UPDATE_TEXT.body(asked.length, updateSizeGB(asked))}
          </Text>
          {notices.map(({ modelName, replacement }) => (
            <Text key={modelName} style={styles.body}>
              {MODEL_UPDATE_TEXT.retired(modelName, replacement)}
            </Text>
          ))}
          <View style={styles.list}>
            {asked.map((model) => (
              <View key={model.id} style={styles.row}>
                <Text style={styles.rowName}>{model.modelName}</Text>
                <Text style={styles.rowMeta}>
                  {`${(model.modelSize ?? 0).toFixed(2)} GB`}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.buttons}>
            <PrimaryButton
              text={MODEL_UPDATE_TEXT.action(asked.length)}
              onPress={handleUpdate}
            />
            <SecondaryButton
              text={MODEL_UPDATE_TEXT.later}
              onPress={handleLater}
            />
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
      {ConfirmElement}
    </>
  );
};

export default ModelUpdateSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      paddingVertical: space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + 16,
      gap: space.four,
      backgroundColor: theme.bg.softPrimary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      color: theme.text.primary,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.defaultSecondary,
    },
    list: {
      gap: space.two,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softSecondary,
    },
    rowName: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    rowMeta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
    buttons: {
      gap: space.two,
    },
  });
