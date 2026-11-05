const TOP_ZONE = 8;

export interface ScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

const clampToScrollRange = ({
  offset,
  contentHeight,
  viewportHeight,
}: ScrollMetrics) =>
  Math.min(offset, Math.max(contentHeight - viewportHeight, 0));

export const isNewChatCollapsed = (metrics: ScrollMetrics) =>
  clampToScrollRange(metrics) > TOP_ZONE;
