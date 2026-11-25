import React, { RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet, Text } from 'react-native';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { ContextSizeSelector } from '../settings/ContextSizeSelector';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import type { Model } from '../../database/modelRepository';
import { CONVERSATION_MEMORY_LABEL } from '../../constants/conversation-memory-copy';
import { space } from '../../constants/design-system';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  model?: Model | null;
  disabled?: boolean;
}

const ContextSizeSheet = ({
  bottomSheetModalRef,
  model,
  disabled = false,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <BackDismissibleSheetModal ref={bottomSheetModalRef} enableDynamicSizing>
      <BottomSheetView style={styles.sheet} testID="context-size-sheet">
        <Text style={styles.title} accessibilityRole="header">
          {CONVERSATION_MEMORY_LABEL}
        </Text>
        <ContextSizeSelector
          model={model}
          disabled={disabled}
          label={CONVERSATION_MEMORY_LABEL}
        />
      </BottomSheetView>
    </BackDismissibleSheetModal>
  );
};

export default ContextSizeSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      paddingVertical: space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
      gap: space.four,
      backgroundColor: theme.bg.sheet,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
