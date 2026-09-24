import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { SvgComponent } from '../../../utils/SvgComponent';
import CameraIcon from '../../../assets/icons/camera.svg';
import ImageIcon from '../../../assets/icons/image.svg';
import AttachmentIcon from '../../../assets/icons/attachment.svg';
import MenuRow from '../../menu/MenuRow';
import { MENU, MENU_HEIGHT, PANEL_CONTENT, PRESS_ANYWHERE } from './constants';

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

interface Props {
  onSelect: (action: MenuAction) => void;
  imagesEnabled?: boolean;
  busy?: MenuAction | null;
}

const AttachmentMenu = ({
  onSelect,
  imagesEnabled = true,
  busy = null,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.root}>
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
