import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { TEXT_SELECTION, Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { useKeyboardOwnerStore } from '../../store/keyboardOwnerStore';
import { useHoldKeyboardWhileOpen } from '../../hooks/useHoldKeyboardWhileOpen';
import { MAX_CHAT_TITLE_LENGTH } from '../../utils/chatLabel';
import { SvgComponent } from '../../utils/SvgComponent';
import Popover from '../menu/Popover';
import { MenuPlacement, menuAnchor } from './placement';
import PopoverRow from '../menu/PopoverRow';
import EditIcon from '../../assets/icons/edit.svg';
import ShareIcon from '../../assets/icons/upload.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import LockIcon from '../../assets/icons/lock-solid.svg';

const ICON_BUTTON_SIZE = 36;
const ICON_SIZE = 16;
const ROW_ICON_SIZE = 17;
const ROW_ICON_WELL = 28;
const NAME_LINE_HEIGHT = lineHeights.md;
const TITLE_BLOCK_HEIGHT = lineHeights.xs + NAME_LINE_HEIGHT;
const FIELD_HEIGHT = TITLE_BLOCK_HEIGHT;
const FIELD_BORDER = 1.5;
const ROW_LABEL_SIZE = 15;
const PRIVACY_LOCK_TILE = 28;
const PRIVACY_LOCK_WIDTH = 10;
const PRIVACY_LOCK_HEIGHT = 12;
const PRIVACY_LINK_HIT_SLOP = 8;

export const PRIVATE_CHAT_DETAIL =
  'This chat runs on your device. It is stored here and works offline.';

interface Props {
  visible: boolean;
  placement: MenuPlacement;
  title: string;
  onRename: (title: string) => void;
  onShare: () => void;
  onDelete: () => void;
  onPrivacy?: () => void;
  onClose: () => void;
}

const ChatMenuPopover = ({
  visible,
  placement,
  title,
  onRename,
  onShare,
  onDelete,
  onPrivacy,
  onClose,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const window = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) =>
    state.isVisible ? state.height : 0
  );
  const [menuHeight, setMenuHeight] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setDraft(null);
  }, [visible]);

  const setModalOwnsKeyboard = useKeyboardOwnerStore(
    (state) => state.setModalOwnsKeyboard
  );
  useHoldKeyboardWhileOpen(visible, setModalOwnsKeyboard);

  const saveDraft = () => {
    const next = draft?.trim();
    Keyboard.dismiss();
    setDraft(null);
    if (next && next !== title) onRename(next);
  };

  return (
    <Popover
      visible={visible}
      anchor={menuAnchor(placement, window, keyboardHeight, menuHeight)}
      onLayout={(event) => setMenuHeight(event.nativeEvent.layout.height)}
      onClose={onClose}
      closeLabel="Close chat options"
      backdropTestID="chat-menu-backdrop"
      accessibilityLabel="Chat options"
      testID="chat-menu"
      hostsTextInput
    >
      <View style={styles.titleBlock}>
        {draft === null ? (
          <View style={styles.grow}>
            <Text style={styles.caption}>Chat</Text>
            <View style={styles.nameRow}>
              <Text
                style={styles.chatTitle}
                numberOfLines={1}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              >
                {title}
              </Text>
              <Pressable
                onPress={() => setDraft(title)}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.pressedControl,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Rename chat"
                testID="chat-menu-rename"
              >
                <EditIcon
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  style={styles.primaryIcon}
                />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              {...TEXT_SELECTION}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={saveDraft}
              autoFocus
              selectTextOnFocus
              maxLength={MAX_CHAT_TITLE_LENGTH}
              returnKeyType="done"
              accessibilityLabel="Chat name"
              placeholderTextColor={theme.text.defaultTertiary}
              style={styles.field}
              testID="chat-menu-rename-input"
            />
            <Pressable
              onPress={saveDraft}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && pressedOpacity,
              ]}
              accessibilityRole="button"
              testID="chat-menu-rename-save"
            >
              <Text
                style={styles.saveLabel}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              >
                Save
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <View style={styles.divider} />
      {onPrivacy && (
        <>
          <View style={styles.privacy} testID="chat-menu-privacy-info">
            <View style={styles.privacyHeading}>
              <View style={styles.privacyLockTile}>
                <LockIcon
                  width={PRIVACY_LOCK_WIDTH}
                  height={PRIVACY_LOCK_HEIGHT}
                  style={styles.accentIcon}
                />
              </View>
              <Text
                style={styles.privacyTitle}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              >
                Private chat
              </Text>
            </View>
            <Text
              style={styles.privacyDetail}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              {PRIVATE_CHAT_DETAIL}
            </Text>
            <Pressable
              onPress={onPrivacy}
              hitSlop={PRIVACY_LINK_HIT_SLOP}
              style={({ pressed }) => [
                styles.privacyLink,
                pressed && pressedOpacity,
              ]}
              accessibilityRole="button"
              testID="chat-menu-privacy"
            >
              <Text
                style={styles.privacyLinkLabel}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              >
                How this works
              </Text>
            </Pressable>
          </View>
          <View style={styles.divider} />
        </>
      )}
      <View style={styles.actions}>
        <ActionRow
          label="Share"
          icon={ShareIcon}
          onPress={onShare}
          testID="chat-menu-share"
        />
        <ActionRow
          label="Delete chat"
          icon={TrashIcon}
          onPress={onDelete}
          destructive
          testID="chat-menu-delete"
        />
      </View>
    </Popover>
  );
};

interface ActionRowProps {
  label: string;
  icon: SvgComponent;
  onPress: () => void;
  destructive?: boolean;
  testID: string;
}

const ActionRow = ({
  label,
  icon: Icon,
  onPress,
  destructive = false,
  testID,
}: ActionRowProps) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <PopoverRow onPress={onPress} accessibilityRole="button" testID={testID}>
      <View style={styles.rowIcon}>
        <Icon
          width={ROW_ICON_SIZE}
          height={ROW_ICON_SIZE}
          style={destructive ? styles.destructive : styles.secondaryIcon}
        />
      </View>
      <Text style={[styles.rowLabel, destructive && styles.destructive]}>
        {label}
      </Text>
    </PopoverRow>
  );
};

export default ChatMenuPopover;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    titleBlock: {
      minHeight: TITLE_BLOCK_HEIGHT + space.three * 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
      paddingVertical: space.three,
      paddingLeft: space.four,
      paddingRight: space.two,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    caption: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
      minHeight: NAME_LINE_HEIGHT,
    },
    chatTitle: {
      flex: 1,
      ...textStyles.bodyPrimaryBold,
      color: theme.text.primary,
    },
    iconButton: {
      width: ICON_BUTTON_SIZE,
      height: ICON_BUTTON_SIZE,
      marginVertical: (NAME_LINE_HEIGHT - ICON_BUTTON_SIZE) / 2,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.popoverControl,
    },
    pressedControl: {
      backgroundColor: theme.bg.titlePressed,
    },
    primaryIcon: {
      color: theme.text.primary,
    },
    field: {
      flex: 1,
      minWidth: 0,
      minHeight: FIELD_HEIGHT,
      paddingHorizontal: space.four,
      paddingVertical: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
      borderRadius: radius.full,
      borderWidth: FIELD_BORDER,
      borderColor: theme.text.accent,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    saveButton: {
      minHeight: FIELD_HEIGHT,
      paddingHorizontal: space.four,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.main,
    },
    saveLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      color: theme.text.onBrand,
    },
    divider: {
      height: stroke.soft,
      backgroundColor: theme.border.popover,
    },
    actions: {
      paddingVertical: space.two,
    },
    rowIcon: {
      width: ROW_ICON_WELL,
      height: ROW_ICON_WELL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryIcon: {
      color: theme.text.defaultSecondary,
    },
    accentIcon: {
      color: theme.text.accent,
    },
    privacy: {
      gap: space.two,
      paddingVertical: space.three,
      paddingHorizontal: space.four,
    },
    privacyHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    privacyLockTile: {
      width: PRIVACY_LOCK_TILE,
      height: PRIVACY_LOCK_TILE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.accentSoft,
    },
    privacyTitle: {
      ...textStyles.bodyPrimaryBold,
      color: theme.text.primary,
    },
    privacyDetail: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.defaultSecondary,
    },
    privacyLink: {
      alignSelf: 'flex-start',
    },
    privacyLinkLabel: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.accent,
    },
    rowLabel: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: ROW_LABEL_SIZE,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    destructive: {
      color: theme.text.error,
    },
  });
