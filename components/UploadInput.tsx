import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import FolderWhite from '../assets/icons/folder-white.svg';
import TrashIcon from '../assets/icons/trash.svg';
import AttachmentIcon from '../assets/icons/attachment.svg';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

type Props = {
  fileInfo: { name: string; size: number | null; uri: string } | null;
  onChange: (
    file: { name: string; size: number | null; uri: string } | null
  ) => void;
};

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

const UploadInput = ({ fileInfo, onChange }: Props) => {
  const { theme } = useTheme();
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
        <View style={{ ...styles.emptyBox, borderColor: theme.border.soft }}>
          <TouchableOpacity
            style={{
              ...styles.selectButton,
              backgroundColor: theme.bg.strongPrimary,
            }}
            onPress={handlePickFile}
          >
            <FolderWhite width={16.67} height={14.17} />
            <Text
              style={{
                ...styles.selectButtonText,
                color: theme.text.contrastPrimary,
              }}
            >
              Select a file
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={{ ...styles.fileBox, backgroundColor: theme.bg.softSecondary }}
        >
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <AttachmentIcon width={15.83} height={15.83} />
            <Text style={{ ...styles.fileText, color: theme.text.primary }}>
              {fileInfo.name}
            </Text>
            <Text
              style={{
                ...styles.fileText,
                color: theme.text.defaultSecondary,
              }}
            >
              {fileInfo.size ? `(${formatFileSize(fileInfo.size)})` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onChange(null)}>
            <TrashIcon width={15} height={15.83} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default UploadInput;

const styles = StyleSheet.create({
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  selectButton: {
    height: 40,
    borderRadius: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectButtonText: {
    paddingHorizontal: 4,
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.sm,
  },
  fileBox: {
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fileText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
});
