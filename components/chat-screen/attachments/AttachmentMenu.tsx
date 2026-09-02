import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily } from '../../../styles/fontStyles';
import { SvgComponent } from '../../../utils/SvgComponent';
import CameraIcon from '../../../assets/icons/camera.svg';
import ImageIcon from '../../../assets/icons/image.svg';
import AttachmentIcon from '../../../assets/icons/attachment.svg';
import { MENU, MENU_HEIGHT, PANEL_CONTENT, panelPalette } from './constants';

export type MenuAction = 'camera' | 'photos' | 'files';

interface MenuItem {
  action: MenuAction;
  label: string;
  icon: SvgComponent;
  testID: string;
}

const ITEMS: MenuItem[] = [
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

interface Props {
  onSelect: (action: MenuAction) => void;
  /** Image rows read as unavailable when the loaded model has no vision. */
  imagesEnabled?: boolean;
}

/**
 * The rows that live inside the panel while it is still menu-shaped. No
 * background of its own — the panel owns the material — and no size logic,
 * because the panel scales it.
 */
const AttachmentMenu = ({ onSelect, imagesEnabled = true }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const palette = panelPalette(theme);

  return (
    <View style={styles.root}>
      {ITEMS.map((item) => {
        const dimmed = !imagesEnabled && item.action !== 'files';
        const Icon = item.icon;
        return (
          <Pressable
            key={item.action}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={item.testID}
            onPress={() => onSelect(item.action)}
            style={[styles.row, dimmed && styles.rowDimmed]}
          >
            <View style={styles.well}>
              <Icon
                width={MENU.iconSize}
                height={MENU.iconSize}
                style={{ color: palette.text }}
              />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default AttachmentMenu;

const createStyles = (theme: Theme) => {
  const palette = panelPalette(theme);
  return StyleSheet.create({
    root: {
      ...PANEL_CONTENT,
      width: MENU.width,
      height: MENU_HEIGHT,
      paddingVertical: MENU.paddingVertical,
    },
    row: {
      height: MENU.itemHeight,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: MENU.iconInset,
    },
    rowDimmed: {
      opacity: 0.4,
    },
    well: {
      width: MENU.iconWell,
      height: MENU.iconWell,
      borderRadius: MENU.iconWell / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.iconWell,
    },
    label: {
      marginLeft: MENU.labelGap,
      color: palette.text,
      fontSize: MENU.labelSize,
      fontFamily: fontFamily.regular,
      letterSpacing: -0.2,
    },
  });
};
