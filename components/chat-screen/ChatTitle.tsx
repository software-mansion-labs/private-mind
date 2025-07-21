import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

interface Props {
  title: string;
  modelName: string;
}

const ChatTitle = ({ title, modelName }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.titleContainer}>
      {title !== '' ? (
        <>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.modelName}>{modelName}</Text>
        </>
      ) : (
        <View style={styles.modelNameTitleContainer}>
          <Text style={styles.modelNameTitle}>{modelName}</Text>
        </View>
      )}
    </View>
  );
};

export default ChatTitle;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    titleContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    modelName: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      width: '100%',
      textAlign: 'center',
    },
    modelNameTitle: {
      color: theme.text.primary,
      fontFamily: fontFamily.medium,
    },
    modelNameTitleContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
