import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { type Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { pressedOpacity } from '../../styles/pressable';

const ModelUpdateBanner = ({ model }: { model: Model }) => {
  const { styles } = useThemedStyles(createStyles);
  const download = useModelStore((state) => state.downloadStates[model.id]);
  const updateOutdatedModel = useModelStore(
    (state) => state.updateOutdatedModel
  );
  const updating = download?.status === ModelState.Downloading;

  const handleUpdate = () => updateOutdatedModel(model);

  return (
    <View style={styles.banner} testID="model-update-banner">
      <Text style={styles.text}>
        {MODEL_UPDATE_TEXT.chatBanner(model.modelName)}
      </Text>
      <Pressable
        onPress={handleUpdate}
        disabled={updating}
        accessibilityRole="button"
        style={({ pressed }) => [styles.action, pressed && pressedOpacity]}
      >
        <Text style={styles.actionText}>
          {updating
            ? `${Math.round(download.progress * 100)}%`
            : MODEL_UPDATE_TEXT.chatBannerAction}
        </Text>
      </Pressable>
    </View>
  );
};

export default ModelUpdateBanner;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
    },
    text: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    action: {
      paddingVertical: space.two,
      paddingHorizontal: space.three,
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    actionText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.onBrand,
    },
  });
