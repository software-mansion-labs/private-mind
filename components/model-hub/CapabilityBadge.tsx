import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { isDarkTheme, Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { SvgComponent } from '../../utils/SvgComponent';
import LightBulbIcon from '../../assets/icons/light_bulb.svg';
import EyeIcon from '../../assets/icons/eye.svg';

export type CapabilityTone = 'thinking' | 'vision' | 'neutral';

export interface Capability {
  label: string;
  tone: CapabilityTone;
}

const BADGE_HEIGHT = 24;
const BADGE_ICON_SIZE = 14;

const CAPABILITY_LABELS = new Set(['Thinking', 'Reasoning', 'Vision']);

const THINKING: Capability = { label: 'Thinking', tone: 'thinking' };
const VISION: Capability = { label: 'Vision', tone: 'vision' };

const toneIcon: Partial<Record<CapabilityTone, SvgComponent>> = {
  thinking: LightBulbIcon,
  vision: EyeIcon,
};

const capabilityTint = {
  light: {
    thinking: { background: '#FFF4D6', foreground: '#8A5A00' },
    vision: { background: '#E0F0FF', foreground: '#0B5CAD' },
  },
  dark: {
    thinking: {
      background: 'rgba(255, 190, 60, 0.18)',
      foreground: '#FFD27A',
    },
    vision: { background: 'rgba(80, 160, 255, 0.18)', foreground: '#8CC4FF' },
  },
};

const tintFor = (theme: Theme, tone: CapabilityTone) => {
  if (tone === 'neutral') {
    return {
      background: theme.bg.softSecondary,
      foreground: theme.text.defaultSecondary,
    };
  }
  return capabilityTint[isDarkTheme(theme) ? 'dark' : 'light'][tone];
};

export const modelCapabilities = (
  model: Pick<Model, 'thinking' | 'vision' | 'labels'>,
  { withLabels = true }: { withLabels?: boolean } = {}
): Capability[] => {
  const capabilities: Capability[] = [];
  if (model.thinking) capabilities.push(THINKING);
  if (model.vision) capabilities.push(VISION);
  if (!withLabels) return capabilities;

  const labels = (model.labels ?? []).filter(
    (label) => !CAPABILITY_LABELS.has(label)
  );
  return [
    ...capabilities,
    ...labels.map((label): Capability => ({ label, tone: 'neutral' })),
  ];
};

const CapabilityBadge = ({ label, tone }: Capability) => {
  const { styles } = useThemedStyles(createStyles, tone);
  const Icon = toneIcon[tone];

  return (
    <View style={styles.badge} testID={`capability-badge-${label}`}>
      {Icon && (
        <Icon
          width={BADGE_ICON_SIZE}
          height={BADGE_ICON_SIZE}
          style={styles.icon}
        />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

export default CapabilityBadge;

const createStyles = (theme: Theme, tone: CapabilityTone) => {
  const tint = tintFor(theme, tone);
  return StyleSheet.create({
    badge: {
      height: BADGE_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
      paddingHorizontal: space.two,
      borderRadius: radius.full,
      backgroundColor: tint.background,
    },
    icon: {
      color: tint.foreground,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: tint.foreground,
    },
  });
};
