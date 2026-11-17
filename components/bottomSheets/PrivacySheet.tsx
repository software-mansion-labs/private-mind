import React, { Fragment, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import PrimaryButton from '../PrimaryButton';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { WEB_SEARCH_ENABLED } from '../../constants/web';
import {
  closedPrivacySheet,
  usePrivacySheetStore,
} from '../../store/privacySheetStore';
import { SvgComponent } from '../../utils/SvgComponent';
import LockIcon from '../../assets/icons/lock-solid.svg';
import ProcessorIcon from '../../assets/icons/processor.svg';
import AirplaneIcon from '../../assets/icons/airplane.svg';
import FolderIcon from '../../assets/icons/folder.svg';
import WebIcon from '../../assets/icons/web.svg';

const HEADER_TILE_SIZE = 56;
const HEADER_LOCK_WIDTH = 20;
const HEADER_LOCK_HEIGHT = 24;
const ICON_TILE_SIZE = 32;
const ICON_TILE_RADIUS = 10;
const ICON_SIZE = 16;
const WEB_ICON_SIZE = 16;
const ROW_PADDING = space.four;
const ROW_TEXT_INSET = ROW_PADDING + ICON_TILE_SIZE + space.three;

export const PRIVACY_SHEET_TITLE = 'Private by design';
export const PRIVACY_SHEET_INTRO =
  'Answers are made on your device. What you write is never sent to a server.';
export const PRIVACY_WEB_NOTE =
  'Web search and links you share are the exception: a short search query or the link is sent to fetch results. Your chat itself stays here.';

interface Row {
  key: string;
  icon: SvgComponent;
  title: string;
  detail: string;
}

const PRIVACY_ROWS: Row[] = [
  {
    key: 'device',
    icon: ProcessorIcon,
    title: 'Runs on your device',
    detail: "Models answer with your phone's own chip.",
  },
  {
    key: 'offline',
    icon: AirplaneIcon,
    title: 'Works offline',
    detail: 'Once a model is downloaded, no connection is needed.',
  },
  {
    key: 'stored',
    icon: FolderIcon,
    title: 'Stored only here',
    detail: 'Chats and files are saved on this device. No account needed.',
  },
];

const PrivacyRow = ({ row }: { row: Row }) => {
  const { styles } = useThemedStyles(createStyles);
  const Icon = row.icon;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${row.title}: ${row.detail}`}
      testID={`privacy-row-${row.key}`}
    >
      <View style={styles.iconTile}>
        <Icon width={ICON_SIZE} height={ICON_SIZE} style={styles.rowIcon} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{row.title}</Text>
        <Text style={styles.rowDetail}>{row.detail}</Text>
      </View>
    </View>
  );
};

const PrivacySheet = () => {
  const { styles } = useThemedStyles(createStyles);
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    usePrivacySheetStore.setState({
      openPrivacySheet: () => {
        Keyboard.dismiss();
        sheetRef.current?.present();
      },
    });
    return () =>
      usePrivacySheetStore.setState({ openPrivacySheet: closedPrivacySheet });
  }, []);

  return (
    <BackDismissibleSheetModal
      ref={sheetRef}
      enableDynamicSizing
      accessible={false}
    >
      <BottomSheetView style={styles.sheet} testID="privacy-sheet">
        <View style={styles.header}>
          <View style={styles.headerTile}>
            <LockIcon
              width={HEADER_LOCK_WIDTH}
              height={HEADER_LOCK_HEIGHT}
              style={styles.headerLock}
            />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {PRIVACY_SHEET_TITLE}
          </Text>
          <Text style={styles.intro}>{PRIVACY_SHEET_INTRO}</Text>
        </View>
        <View style={styles.group}>
          {PRIVACY_ROWS.map((row, index) => (
            <Fragment key={row.key}>
              {index > 0 && <View style={styles.separator} />}
              <PrivacyRow row={row} />
            </Fragment>
          ))}
        </View>
        {WEB_SEARCH_ENABLED && (
          <View style={styles.webNote} accessible testID="privacy-web-note">
            <WebIcon
              width={WEB_ICON_SIZE}
              height={WEB_ICON_SIZE}
              style={styles.webIcon}
            />
            <Text style={styles.webText}>{PRIVACY_WEB_NOTE}</Text>
          </View>
        )}
        <PrimaryButton
          text="Got it"
          onPress={() => sheetRef.current?.dismiss()}
        />
      </BottomSheetView>
    </BackDismissibleSheetModal>
  );
};

export default PrivacySheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      paddingTop: space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.three,
      gap: space.six,
      backgroundColor: theme.bg.softPrimary,
    },
    header: {
      alignItems: 'center',
      gap: space.two,
    },
    headerTile: {
      width: HEADER_TILE_SIZE,
      height: HEADER_TILE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.accentSoft,
    },
    headerLock: {
      color: theme.text.accent,
    },
    title: {
      ...textStyles.titleSheet,
      marginTop: space.two,
      textAlign: 'center',
      color: theme.text.primary,
    },
    intro: {
      ...textStyles.bodySecondaryRegular,
      textAlign: 'center',
      color: theme.text.defaultSecondary,
    },
    group: {
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.softTertiary,
      overflow: 'hidden',
    },
    separator: {
      height: stroke.soft,
      marginLeft: ROW_TEXT_INSET,
      backgroundColor: theme.border.popover,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      paddingVertical: space.three,
      paddingHorizontal: ROW_PADDING,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: ICON_TILE_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.softPrimary,
    },
    rowIcon: {
      color: theme.text.primary,
    },
    rowText: {
      flex: 1,
      gap: space.half,
    },
    rowTitle: {
      ...textStyles.bodyPrimaryMedium,
      color: theme.text.primary,
    },
    rowDetail: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultTertiary,
    },
    webNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
      paddingHorizontal: ROW_PADDING,
    },
    webIcon: {
      marginTop:
        (textStyles.bodySecondaryRegular.lineHeight - WEB_ICON_SIZE) / 2,
      color: theme.text.defaultTertiary,
    },
    webText: {
      flex: 1,
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultTertiary,
    },
  });
