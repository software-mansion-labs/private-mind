import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  icon: React.ReactNode;
  backgroundColor: string;
  onPress: () => void;
}

const CircleButton = ({ icon, backgroundColor, onPress }: Props) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ ...styles.circle, backgroundColor }}
    >
      {icon}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    padding: 8,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CircleButton;
