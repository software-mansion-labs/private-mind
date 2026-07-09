import { StyleProp, ViewStyle } from 'react-native';
import { SvgProps } from 'react-native-svg';

export interface CustomSvgProps extends Omit<SvgProps, 'style'> {
  style?: StyleProp<ViewStyle & { color?: string }>;
}

export type SvgComponent = React.ComponentType<CustomSvgProps>;
