import React, { useEffect, useRef } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import Logo from '../../assets/icons/logo.svg';
import StarIcon from '../../assets/icons/star.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useMilestoneNudgeStore } from '../../store/milestoneNudgeStore';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, textStyles } from '../../constants/design-system';
import { rateApp } from '../../utils/rateApp';
import { milestoneHeadline } from '../../utils/shareUsageCard';

const LOGO_TILE_SIZE = 56;
const LOGO_WIDTH = 23;
const LOGO_HEIGHT = 26;
const STAR_SIZE = 18;
const NOT_NOW_HEIGHT = 40;
const MILESTONE_DETAIL =
  'Every word was written on this phone, with nothing sent to the cloud. Sharing it or leaving a rating helps others find a private AI.';

const MilestoneSheet = () => {
  const { styles, theme } = useThemedStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal>(null);
  const milestonePages = useMilestoneNudgeStore(
    (state) => state.milestonePages
  );
  const dismissMilestone = useMilestoneNudgeStore(
    (state) => state.dismissMilestone
  );

  useEffect(() => {
    if (milestonePages === null) return;
    Keyboard.dismiss();
    sheetRef.current?.present();
  }, [milestonePages]);

  const handleDismissed = () => dismissMilestone();
  const handleNotNow = () => sheetRef.current?.dismiss();
  const handleShare = () => {
    sheetRef.current?.dismiss();
    router.push('/my-private-mind');
  };
  const handleRate = () => {
    sheetRef.current?.dismiss();
    rateApp();
  };

  return (
    <BackDismissibleSheetModal
      ref={sheetRef}
      enableDynamicSizing
      onDismiss={handleDismissed}
    >
      <BottomSheetView style={styles.sheet} testID="milestone-sheet">
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <Logo width={LOGO_WIDTH} height={LOGO_HEIGHT} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {milestoneHeadline(milestonePages ?? 0)}
          </Text>
          <Text style={styles.detail}>{MILESTONE_DETAIL}</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton text="Share my Private Mind" onPress={handleShare} />
          <SecondaryButton
            text="Rate Private Mind"
            icon={
              <StarIcon
                width={STAR_SIZE}
                height={STAR_SIZE}
                color={theme.text.primary}
              />
            }
            onPress={handleRate}
            style={styles.rateButton}
          />
          <Pressable
            onPress={handleNotNow}
            accessibilityRole="button"
            style={({ pressed }) => [styles.notNow, pressed && pressedOpacity]}
          >
            <Text style={styles.notNowText}>Not now</Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BackDismissibleSheetModal>
  );
};

export default MilestoneSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      paddingTop: space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.three,
      gap: space.six,
      backgroundColor: theme.bg.sheet,
    },
    header: {
      alignItems: 'center',
      gap: space.two,
    },
    logoTile: {
      width: LOGO_TILE_SIZE,
      height: LOGO_TILE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.accentSoft,
    },
    title: {
      ...textStyles.titleSheet,
      marginTop: space.two,
      textAlign: 'center',
      color: theme.text.primary,
    },
    detail: {
      ...textStyles.bodySecondaryRegular,
      textAlign: 'center',
      color: theme.text.defaultSecondary,
    },
    actions: {
      gap: space.two,
    },
    rateButton: {
      gap: space.two,
    },
    notNow: {
      height: NOT_NOW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notNowText: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.defaultTertiary,
    },
  });
