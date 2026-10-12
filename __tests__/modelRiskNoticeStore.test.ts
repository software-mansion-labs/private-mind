import { useModelRiskNoticeStore } from '../store/modelRiskNoticeStore';

describe('model risk notice dismissals', () => {
  beforeEach(() => {
    useModelRiskNoticeStore.setState({ dismissedModelIds: [] });
  });

  it('remembers a dismissal per model, not globally', () => {
    useModelRiskNoticeStore.getState().dismissForModel(7);
    const { isDismissedForModel } = useModelRiskNoticeStore.getState();
    expect(isDismissedForModel(7)).toBe(true);
    expect(isDismissedForModel(8)).toBe(false);
  });

  it('does not grow the list on a repeated dismissal', () => {
    const { dismissForModel } = useModelRiskNoticeStore.getState();
    dismissForModel(7);
    dismissForModel(7);
    expect(useModelRiskNoticeStore.getState().dismissedModelIds).toEqual([7]);
  });
});
