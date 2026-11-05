import React, { type Ref, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import PrimaryButton from '../PrimaryButton';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { space, textStyles } from '../../constants/design-system';
import { LATEST_RELEASE } from '../../constants/latest-release';

interface Props {
  ref?: Ref<BottomSheetModal | null>;
  version: string;
}

const WhatsNewSheet = ({ ref, version }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const ownRef = useRef<BottomSheetModal | null>(null);

  return (
    <BackDismissibleSheetModal
      ref={(sheet: BottomSheetModal | null) => {
        ownRef.current = sheet;
        if (typeof ref === 'function') ref(sheet);
        else if (ref) ref.current = sheet;
      }}
      enableDynamicSizing
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        testID="whats-new-sheet"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>What's new</Text>
          <Text style={styles.version}>v{version}</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {LATEST_RELEASE.title}
        </Text>
        <View style={styles.list}>
          {LATEST_RELEASE.highlights.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.item}>{item}</Text>
            </View>
          ))}
        </View>
        <PrimaryButton
          text="Got it"
          onPress={() => ownRef.current?.dismiss()}
        />
      </BottomSheetScrollView>
    </BackDismissibleSheetModal>
  );
};

export default WhatsNewSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingTop: space.two,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
      gap: space.four,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.accent,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    version: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    title: {
      ...textStyles.titleSheet,
      color: theme.text.primary,
    },
    list: {
      gap: space.two,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.two,
    },
    bullet: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.accent,
    },
    item: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.defaultSecondary,
    },
  });
