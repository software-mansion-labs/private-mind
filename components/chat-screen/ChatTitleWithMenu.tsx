import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';

interface Props {
  title: string;
  modelName: string;
}

const ChatTitleWithMenu = ({ title, modelName }: Props) => {
  const { theme } = useTheme();

  return (
    <View style={styles.titleContainer}>
      <Text style={{ ...styles.title, color: theme.text.primary }}>
        {title}
      </Text>
      <Text style={{ ...styles.modelName, color: theme.text.defaultSecondary }}>
        {modelName}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  modelName: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.regular,
    width: '100%',
    textAlign: 'center',
  },
});

export default ChatTitleWithMenu;
