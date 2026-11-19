import React, { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { Glass } from './Glass';
import { GLASS_BUTTON_SIZE, HEADER_EDGE_PX } from '../constants/header-actions';

type Props = PropsWithChildren<{
  edge: 'leading' | 'trailing';
}>;

const HeaderGlassButton = ({ edge, children }: Props) => (
  <Glass
    radius={GLASS_BUTTON_SIZE / 2}
    style={[
      styles.circle,
      edge === 'leading' ? styles.leading : styles.trailing,
    ]}
  >
    {children}
  </Glass>
);

export default HeaderGlassButton;

export const headerGlassButtonFill = StyleSheet.create({
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
}).fill;

const styles = StyleSheet.create({
  circle: {
    width: GLASS_BUTTON_SIZE,
    height: GLASS_BUTTON_SIZE,
  },
  leading: {
    marginLeft: HEADER_EDGE_PX,
  },
  trailing: {
    marginRight: HEADER_EDGE_PX,
  },
});
