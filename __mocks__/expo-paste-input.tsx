import React from 'react';
import { View } from 'react-native';

export interface PasteEventPayload {
  type: 'text' | 'images' | 'unsupported';
  text?: string;
  uris?: string[];
}

export const TextInputWrapper = ({ children, onPaste, style, ...props }: any) => {
  return (
    <View style={style} {...props}>
      {children}
    </View>
  );
};
