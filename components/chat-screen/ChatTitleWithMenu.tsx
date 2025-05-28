import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
  title: string;
  onSelect: (action: string) => void;
}

const ChatTitleWithMenu = ({ title, onSelect }: Props) => {
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
        <Text style={styles.title}>Local Mind</Text>
        <Ionicons name="chevron-forward" size={16} color="gray" />
      </TouchableOpacity>
    </MenuView>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ChatTitleWithMenu;
