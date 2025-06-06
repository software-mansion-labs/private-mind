import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';

interface Props {
  title: string;
  modelName: string;
  onSelect: (action: string) => void;
}

const ChatTitleWithMenu = ({ title, modelName, onSelect }: Props) => {
  const { theme } = useTheme();

  return (
    <MenuView
      title={title}
      onPressAction={({ nativeEvent }) => onSelect(nativeEvent.event)}
      actions={[
        {
          id: 'rename',
          title: 'Rename',
        },
        {
          id: 'details',
          title: 'Details',
        },
        {
          id: 'import',
          title: 'Import',
        },
        {
          id: 'export',
          title: 'Export',
        },
        {
          id: 'delete',
          title: 'Delete',
          attributes: {
            destructive: true,
          },
        },
      ]}
    >
      <TouchableOpacity style={styles.titleContainer}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            {title}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="gray" />
        </View>
      </TouchableOpacity>
      <Text style={{ ...styles.modelName, color: theme.text.defaultSecondary }}>
        {modelName}
      </Text>
    </MenuView>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.fontSizeMd,
    fontFamily: fontFamily.medium,
  },
  modelName: {
    fontSize: fontSizes.fontSizeXs,
    fontFamily: fontFamily.regular,
    width: '100%',
    textAlign: 'center',
  },
});

export default ChatTitleWithMenu;
