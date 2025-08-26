import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../../styles/fontStyles';
import { Theme } from '../../../styles/colors';
import PrimaryButton from '../../PrimaryButton';
import UploadIcon from '../../../assets/icons/upload.svg';

interface Props {
  onUploadSource: () => void;
}

const EmptySourcesView = ({ onUploadSource }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Use source files</Text>
      <Text style={styles.subText}>
        Add text documents the model will use to extend the knowledge used for
        responses.
      </Text>
      <PrimaryButton
        text="Upload source files"
        icon={
          <UploadIcon
            style={{ color: theme.text.contrastPrimary }}
            width={16}
            height={16}
          />
        }
        onPress={onUploadSource}
      />
    </View>
  );
};

export default EmptySourcesView;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: 24,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
