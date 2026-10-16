import { stroke } from '../../constants/design-system';
import { Theme } from '../../styles/colors';

export const composerControlColors = (theme: Theme) => ({
  backgroundColor: theme.bg.chatBarBadge,
  borderColor: theme.border.chatBar,
});

export const composerControlSurface = (theme: Theme) => ({
  borderWidth: stroke.soft,
  ...composerControlColors(theme),
});
