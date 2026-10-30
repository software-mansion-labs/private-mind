import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import { space } from '../../constants/design-system';
import { pressedOpacity } from '../../styles/pressable';
import CircleButton from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import DownloadedBadge from './DownloadedBadge';
import { ROW_PADDING } from './RowGroup';
import TrashIcon from '../../assets/icons/trash.svg';

interface Props {
  model: Model;
  onDelete?: (model: Model) => void;
  onPress?: (model: Model) => void;
}

const DownloadedModelRow = ({ model, onDelete, onPress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && pressedOpacity]}
      onPress={onPress ? () => onPress(model) : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={model.modelName}
      testID="downloaded-model-row"
    >
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {model.modelName}
          </Text>
          <DownloadedBadge />
        </View>
        {model.modelSize ? (
          <Text style={styles.size}>{model.modelSize.toFixed(2)} GB</Text>
        ) : null}
      </View>
      {onDelete && (
        <CircleButton
          onPress={() => onDelete(model)}
          backgroundColor={theme.bg.errorSecondary}
          color={theme.text.error}
          icon={TrashIcon}
          size={16}
          testID="downloaded-model-delete"
        />
      )}
    </Pressable>
  );
};

export default DownloadedModelRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: ROW_PADDING,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.four,
    },
    name: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    size: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
  });
