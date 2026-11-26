import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type Svg from 'react-native-svg';
import Toast from 'react-native-toast-message';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../components/GlassScreenHeader';
import PrimaryButton from '../../components/PrimaryButton';
import { SHARE_CARD_RADIUS, ShareCard } from '../../components/share/ShareCard';
import ShareIcon from '../../assets/icons/upload.svg';
import { space, textStyles } from '../../constants/design-system';
import { loadUsageTotals } from '../../database/usageStatsRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { type UsageSummary, summarizeUsage } from '../../utils/usageStats';
import {
  buildUsageShareMessage,
  shareCardContent,
  shareUsageCard,
  thisPhoneName,
} from '../../utils/shareUsageCard';

const MY_PRIVATE_MIND_TITLE = 'My Private Mind';
const MAX_CARD_WIDTH = 400;
const SHARE_ICON_SIZE = 20;
const PRIVACY_NOTE =
  'These numbers are counted on this phone and never leave it. Sharing sends only this picture and a link to the app.';
const EMPTY_NOTE =
  'Nothing written yet. Chat a little and your phone will start filling pages.';

export default function MyPrivateMindScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const headerHeight = useGlassScreenHeaderHeight();
  const { styles, theme } = useThemedStyles(createStyles, headerHeight);
  const { width: windowWidth } = useWindowDimensions();
  const cardRef = useRef<Svg>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [sharing, setSharing] = useState(false);
  const deviceName = useMemo(thisPhoneName, []);
  const cardWidth = Math.min(windowWidth - space.four * 2, MAX_CARD_WIDTH);

  useEffect(() => {
    let cancelled = false;
    loadUsageTotals(db)
      .then((totals) => {
        if (!cancelled) setSummary(summarizeUsage(totals));
      })
      .catch((error) => console.warn('Loading usage stats failed:', error));
    return () => {
      cancelled = true;
    };
  }, [db]);

  const handleBack = () => router.back();

  const handleShare = () => {
    const card = cardRef.current;
    if (!summary || !card) return;
    setSharing(true);
    card.toDataURL(async (pngBase64: string) => {
      try {
        await shareUsageCard(
          pngBase64,
          buildUsageShareMessage(summary, deviceName)
        );
      } catch (error) {
        console.warn('Sharing the card failed:', error);
        Toast.show({ type: 'defaultToast', text1: 'Could not share the card' });
      } finally {
        setSharing(false);
      }
    });
  };

  const note = summary && summary.tokens === 0 ? EMPTY_NOTE : PRIVACY_NOTE;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardFrame} testID="my-private-mind-card">
          {summary && (
            <ShareCard
              ref={cardRef}
              content={shareCardContent(summary, deviceName)}
              width={cardWidth}
            />
          )}
        </View>
        <Text style={styles.note}>{note}</Text>
        <PrimaryButton
          text="Share"
          icon={
            <ShareIcon
              width={SHARE_ICON_SIZE}
              height={SHARE_ICON_SIZE}
              color={theme.text.contrastPrimary}
            />
          }
          onPress={handleShare}
          disabled={!summary || sharing}
        />
      </ScrollView>
      <GlassScreenHeader title={MY_PRIVATE_MIND_TITLE} onBack={handleBack} />
    </View>
  );
}

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      paddingTop: headerHeight + space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
      gap: space.five,
      alignItems: 'center',
    },
    cardFrame: {
      borderRadius: SHARE_CARD_RADIUS,
      borderCurve: 'continuous',
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.popover,
    },
    note: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultTertiary,
      textAlign: 'center',
    },
  });
