import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { SvgComponent } from '../../../utils/SvgComponent';
import CameraIcon from '../../../assets/icons/camera.svg';
import ImageIcon from '../../../assets/icons/image.svg';
import AttachmentIcon from '../../../assets/icons/attachment.svg';
import MenuRow from '../../menu/MenuRow';
import { MENU, MENU_HEIGHT, PANEL_CONTENT } from './constants';

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
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.root}>
      {ITEMS.map((item) => (
        <MenuRow
          key={item.action}
          label={item.label}
          icon={item.icon}
          testID={item.testID}
          dimmed={!imagesEnabled && item.action !== 'files'}
          onPress={() => onSelect(item.action)}
        />
      ))}
    </View>
  );
};

export default AttachmentMenu;

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    root: {
      ...PANEL_CONTENT,
      width: MENU.width,
      height: MENU_HEIGHT,
      paddingVertical: MENU.paddingVertical,
      paddingHorizontal: MENU.paddingHorizontal,
    },
  });
