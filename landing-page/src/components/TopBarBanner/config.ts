import type { BannerZone } from './shared';

export const TOP_BAR_BANNER = {
  rotateIntervalMs: 4000,
  hiddenPaths: [] as string[],
  zones: [
    {
      zoneId: 'private-mind-topbar-1',
      contentId: 'ea15c4216158c4097b65fe6504a4b3b7',
      fallbackBgColor: '#3d61d6',
    },
    {
      zoneId: 'private-mind-topbar-2',
      contentId: 'ea15c4216158c4097b65fe6504a4b3b7',
      fallbackBgColor: '#3d61d6',
    },
    {
      zoneId: 'private-mind-topbar-3',
      contentId: 'ea15c4216158c4097b65fe6504a4b3b7',
      fallbackBgColor: '#3d61d6',
    },
  ] satisfies BannerZone[],
};
