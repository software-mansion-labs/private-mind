import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import Folder from '../assets/icons/folder.svg';
import TrashIcon from '../assets/icons/trash.svg';
import AttachmentIcon from '../assets/icons/attachment.svg';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { Theme } from '../styles/colors';

interface Props {
  fileInfo: { name: string; size: number | null; uri: string } | null;
  onChange: (
    file: { name: string; size: number | null; uri: string } | null
  ) => void;
  disabled?: boolean;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes || isNaN(bytes)) return '';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${bytes} B`;
};

const UploadInput = ({ fileInfo, onChange, disabled = false }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(
    () => createStyles(theme, disabled),
    [theme, disabled]
  );

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri || '';
      const normalizedUri =
        Platform.OS === 'ios' ? uri.replace('file://', '') : uri;

      onChange({
        name: asset.name || asset.uri.split('/').pop() || 'Unnamed',
        size: asset.size || null,
        uri: normalizedUri,
      });
    }
  };

  return (
    <View>
      {!fileInfo ? (
        <View style={styles.emptyBox}>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={handlePickFile}
            disabled={disabled}
          >
            <Folder width={16.67} height={14.17} style={styles.iconContrast} />
            <Text style={styles.selectButtonText}>Select a file</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.fileBox}>
          <View style={styles.fileInfo}>
            <AttachmentIcon
              width={15.83}
              height={15.83}
              style={styles.iconPrimary}
            />
            <Text style={styles.fileText}>{fileInfo.name}</Text>
            {fileInfo.size ? (
              <Text style={styles.fileTextSecondary}>
                ({formatFileSize(fileInfo.size)})
              </Text>
            ) : null}
          </View>
          {!disabled && (
            <TouchableOpacity onPress={() => onChange(null)}>
              <TrashIcon width={15} height={15.83} style={styles.iconPrimary} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default UploadInput;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    emptyBox: {
      height: 80,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderColor: theme.border.soft,
    },
    selectButton: {
      height: 40,
      borderRadius: 12,
      paddingHorizontal: 10,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
    },
    selectButtonText: {
      paddingHorizontal: 4,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.contrastPrimary,
    },
    fileBox: {
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.bg.softSecondary,
      opacity: disabled ? 0.4 : 1,
    },
    fileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    fileText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    fileTextSecondary: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
    iconPrimary: {
      color: theme.text.primary,
    },
    iconContrast: {
      color: theme.text.contrastPrimary,
    },
  });
