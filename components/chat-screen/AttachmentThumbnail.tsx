import React, { useMemo } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import CloseIcon from '../../assets/icons/close.svg';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import { Attachment } from '../../hooks/useAttachment';

interface Props {
  attachment: Attachment;
  onRemove: () => void;
}

const AttachmentThumbnail = ({ attachment, onRemove }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderContent = () => {
    if (attachment.status === 'loading') {
      return (
        <View style={styles.placeholder}>
          <ActivityIndicator color={theme.text.primary} />
        </View>
      );
    }

    if (attachment.type === 'image') {
      return (
        <Image
          source={{ uri: attachment.uri }}
          style={styles.thumbnail}
          testID="attachment-image-preview"
        />
      );
    }

    return (
      <View style={styles.docThumbnail}>
        <AttachmentIcon
          width={22}
          height={22}
          style={{ color: theme.text.primary }}
        />
        <Text style={styles.fileName} numberOfLines={1}>
          {attachment.name || 'Document'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.wrapper} testID={`attachment-thumb-${attachment.id}`}>
      {renderContent()}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={onRemove}
        testID={`attachment-dismiss-${attachment.id}`}
      >
        <CloseIcon width={8} height={8} style={styles.dismissIcon} />
      </TouchableOpacity>
    </View>
  );
};

export default AttachmentThumbnail;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'relative',
    },
    thumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
    },
    placeholder: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    docThumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      padding: 4,
    },
    fileName: {
      fontSize: fontSizes.xxs,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
      maxWidth: 60,
      textAlign: 'center',
    },
    dismissButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.bg.strongPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dismissIcon: {
      color: theme.text.contrastPrimary,
    },
  });
