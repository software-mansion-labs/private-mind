import React, { useEffect, useState } from 'react';
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

/** How long the image rows say why they are dimmed. */
const NOTICE_MS = 2400;
const UNSUPPORTED_LABEL = 'Images not supported';

interface Props {
  onSelect: (action: MenuAction) => void;
  imagesEnabled?: boolean;
  /**
   * Bumped every time an image row is tapped on a model that cannot take
   * images. The answer belongs here rather than in a toast: on Android the
   * panel is hosted in the window above the keyboard and a toast is drawn in
   * the app's own, which means underneath it.
   */
  unsupportedAt?: number;
  /** The row whose work is still in flight — the OS can take seconds to put a
   *  picker up, and a row that does nothing reads as a row that failed. */
  busy?: MenuAction | null;
}

/**
 * Camera / Photos / Files. Laid out at its natural size and never measured,
 * because the panel scales it.
 */
const AttachmentMenu = ({
  onSelect,
  imagesEnabled = true,
  unsupportedAt = 0,
  busy = null,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!unsupportedAt) return;
    setNotice(true);
    const timer = setTimeout(() => setNotice(false), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [unsupportedAt]);

  useEffect(() => {
    if (imagesEnabled) setNotice(false);
  }, [imagesEnabled]);

  return (
    <View style={styles.root}>
      {ITEMS.map((item) => {
        const dimmed = !imagesEnabled && item.action !== 'files';
        return (
          <MenuRow
            key={item.action}
            label={dimmed && notice ? UNSUPPORTED_LABEL : item.label}
            accessibilityLabel={
              dimmed ? `${item.label}, ${UNSUPPORTED_LABEL}` : item.label
            }
            icon={item.icon}
            testID={item.testID}
            dimmed={dimmed}
            busy={busy === item.action}
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
