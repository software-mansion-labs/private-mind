import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { SvgComponent } from '../../../utils/SvgComponent';
import { Feedback } from '../../../utils/Feedback';
import CameraIcon from '../../../assets/icons/camera.svg';
import ImageIcon from '../../../assets/icons/image.svg';
import AttachmentIcon from '../../../assets/icons/attachment.svg';
import LightBulbIcon from '../../../assets/icons/light_bulb.svg';
import WebIcon from '../../../assets/icons/web.svg';
import MenuRow from '../../menu/MenuRow';
import { ThemedSwitch } from '../../ThemedSwitch';
import { MENU, PANEL_CONTENT, PRESS_ANYWHERE, menuHeight } from './constants';

export type MenuAction = 'camera' | 'photos' | 'files';

interface Item {
  action: MenuAction;
  label: string;
  icon: SvgComponent;
  testID: string;
}

const ITEMS: Item[] = [
  {
    action: 'camera',
    label: 'Camera',
    icon: CameraIcon,
    testID: 'attachment-camera',
  },
  {
    action: 'photos',
    label: 'Photos',
    icon: ImageIcon,
    testID: 'attachment-library',
  },
  {
    action: 'files',
    label: 'Files',
    icon: AttachmentIcon,
    testID: 'attachment-document',
  },
];

export interface MenuTools {
  thinkingEnabled?: boolean;
  thinkingAvailable?: boolean;
  onThinkingToggle?: () => void;
  webSearchEnabled?: boolean;
  webSearchAvailable?: boolean;
  onWebSearchToggle?: () => void;
}

interface Tool {
  key: 'think' | 'web';
  label: string;
  icon: SvgComponent;
  enabled: boolean;
  available: boolean;
  onToggle: () => void;
  rowTestID: string;
  switchTestID: string;
}

const toolsOf = ({
  thinkingEnabled = false,
  thinkingAvailable = true,
  onThinkingToggle,
  webSearchEnabled = false,
  webSearchAvailable = true,
  onWebSearchToggle,
}: MenuTools): Tool[] => [
  ...(onThinkingToggle
    ? [
        {
          key: 'think' as const,
          label: 'Think',
          icon: LightBulbIcon,
          enabled: thinkingEnabled,
          available: thinkingAvailable,
          onToggle: onThinkingToggle,
          rowTestID: 'menu-think-switch',
          switchTestID: 'thinking-toggle',
        },
      ]
    : []),
  ...(onWebSearchToggle
    ? [
        {
          key: 'web' as const,
          label: 'Web search',
          icon: WebIcon,
          enabled: webSearchEnabled,
          available: webSearchAvailable,
          onToggle: onWebSearchToggle,
          rowTestID: 'menu-web-switch',
          switchTestID: 'web-search-toggle',
        },
      ]
    : []),
];

export const attachmentMenuHeight = (tools: MenuTools) => {
  const toolRows = toolsOf(tools).length;
  return menuHeight({
    rows: ITEMS.length + toolRows,
    dividers: toolRows > 0 ? 1 : 0,
  });
};

const flip = (tool: Tool) => {
  if (!tool.available) {
    tool.onToggle();
    return;
  }
  if (tool.enabled) Feedback.toggleOff();
  else Feedback.toggleOn();
  tool.onToggle();
};

interface Props extends MenuTools {
  onSelect: (action: MenuAction) => void;
  imagesEnabled?: boolean;
  busy?: MenuAction | null;
}

const AttachmentMenu = ({
  onSelect,
  imagesEnabled = true,
  busy = null,
  ...menuTools
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const tools = toolsOf(menuTools);

  return (
    <View style={[styles.root, { height: attachmentMenuHeight(menuTools) }]}>
      {ITEMS.map((item) => {
        const dimmed = !imagesEnabled && item.action !== 'files';
        return (
          <MenuRow
            key={item.action}
            label={item.label}
            icon={item.icon}
            testID={item.testID}
            dimmed={dimmed}
            busy={busy === item.action}
            pressRetentionOffset={PRESS_ANYWHERE}
            onPress={() => onSelect(item.action)}
          />
        );
      })}
      {tools.length > 0 && (
        <View testID="menu-divider" style={styles.divider} />
      )}
      {tools.map((tool) => (
        <MenuRow
          key={tool.key}
          label={tool.label}
          icon={tool.icon}
          testID={tool.rowTestID}
          checked={tool.enabled}
          dimmed={!tool.available}
          pressRetentionOffset={PRESS_ANYWHERE}
          onPress={() => flip(tool)}
          trailing={
            <ThemedSwitch
              testID={tool.switchTestID}
              value={tool.enabled}
              disabled={!tool.available}
              onValueChange={() => flip(tool)}
            />
          }
        />
      ))}
    </View>
  );
};

export default AttachmentMenu;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      ...PANEL_CONTENT,
      width: MENU.width,
      paddingVertical: MENU.paddingVertical,
      paddingHorizontal: MENU.paddingHorizontal,
    },
    divider: {
      height: MENU.dividerThickness,
      marginVertical: MENU.dividerMarginVertical,
      marginHorizontal: MENU.dividerMarginHorizontal,
      backgroundColor: theme.border.soft,
    },
  });
