import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  icon: React.ReactNode;
  backgroundColor: string;
  onPress: () => void;
}

const CircleButton = ({ icon, backgroundColor, onPress }: Props) => {
  const styles = useMemo(
    () => createStyles(backgroundColor),
    [backgroundColor]
  );

  return (
    <TouchableOpacity onPress={onPress} style={styles.circle}>
      {icon}
    </TouchableOpacity>
  );
};

export default CircleButton;

const createStyles = (backgroundColor: string) =>
  StyleSheet.create({
    circle: {
      width: 36,
      height: 36,
      padding: 8,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor,
    },
  });
