import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius, space, stroke } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { TEXT_SELECTION, Theme } from '../../styles/colors';
import { useKeyboardOwnerStore } from '../../store/keyboardOwnerStore';
import { SvgComponent } from '../../utils/SvgComponent';
import Popover, { POPOVER_WIDTH } from '../menu/Popover';
import PopoverRow from '../menu/PopoverRow';
import EditIcon from '../../assets/icons/edit.svg';
import ShareIcon from '../../assets/icons/upload.svg';
import TrashIcon from '../../assets/icons/trash.svg';

const GAP_BELOW_TITLE = 8;
const ICON_BUTTON_SIZE = 36;
const ICON_SIZE = 16;
const ROW_ICON_SIZE = 17;
const ROW_ICON_WELL = 28;
const NAME_LINE_HEIGHT = lineHeights.md;
const TITLE_BLOCK_HEIGHT = lineHeights.xs + NAME_LINE_HEIGHT;
const FIELD_HEIGHT = TITLE_BLOCK_HEIGHT;
const FIELD_RADIUS = 10;
const FIELD_BORDER = 1.5;
const ROW_LABEL_SIZE = 15;

interface Props {
  visible: boolean;
  anchorTop: number;
  title: string;
  onRename: (title: string) => void;
  onShare: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const ChatTitlePopover = ({
  visible,
  anchorTop,
  title,
  onRename,
  onShare,
  onDelete,
  onClose,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setDraft(null);
  }, [visible]);

  useHoldKeyboardWhileOpen(visible);

  const saveDraft = () => {
    const next = draft?.trim();
    Keyboard.dismiss();
    setDraft(null);
    if (next && next !== title) onRename(next);
  };

  return (
    <Popover
      visible={visible}
      anchor={{
        top: anchorTop + GAP_BELOW_TITLE,
        left: (width - POPOVER_WIDTH) / 2,
      }}
      onClose={onClose}
      closeLabel="Close chat options"
      backdropTestID="chat-menu-backdrop"
      accessibilityLabel="Chat options"
      testID="chat-menu"
    >
      <View style={styles.titleBlock}>
        {draft === null ? (
          <View style={styles.grow}>
            <Text style={styles.caption}>Chat</Text>
            <View style={styles.nameRow}>
              <Text style={styles.chatTitle} numberOfLines={1}>
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
              {...TEXT_SELECTION}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={saveDraft}
              autoFocus
              selectTextOnFocus
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
                pressed && styles.pressedSave,
              ]}
              accessibilityRole="button"
              testID="chat-menu-rename-save"
            >
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
          </>
        )}
      </View>
      <View style={styles.divider} />
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

const useHoldKeyboardWhileOpen = (open: boolean) => {
  const setModalOwnsKeyboard = useKeyboardOwnerStore(
    (state) => state.setModalOwnsKeyboard
  );
  const claimed = useRef(false);

  useEffect(() => {
    if (open) {
      claimed.current = true;
      setModalOwnsKeyboard(true);
      return;
    }
    if (!claimed.current) return;
    const release = () => {
      claimed.current = false;
      setModalOwnsKeyboard(false);
    };
    if (!Keyboard.isVisible()) {
      release();
      return;
    }
    Keyboard.dismiss();
    const hidden = Keyboard.addListener('keyboardDidHide', release);
    return () => hidden.remove();
  }, [open, setModalOwnsKeyboard]);

  useEffect(
    () => () => {
      if (claimed.current) setModalOwnsKeyboard(false);
    },
    [setModalOwnsKeyboard]
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

export default ChatTitlePopover;

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
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
      height: NAME_LINE_HEIGHT,
    },
    chatTitle: {
      flex: 1,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
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
      height: FIELD_HEIGHT,
      paddingHorizontal: space.twoHalf,
      paddingVertical: 0,
      includeFontPadding: false,
      textAlignVertical: 'center',
      borderRadius: FIELD_RADIUS,
      borderWidth: FIELD_BORDER,
      borderColor: theme.text.accent,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    saveButton: {
      height: FIELD_HEIGHT,
      paddingHorizontal: space.three,
      borderRadius: FIELD_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.main,
    },
    pressedSave: {
      opacity: 0.8,
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
