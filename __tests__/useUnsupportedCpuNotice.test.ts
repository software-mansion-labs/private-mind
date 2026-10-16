import { renderHook, waitFor } from '@testing-library/react-native';
import { useUnsupportedCpuNotice } from '../hooks/useUnsupportedCpuNotice';
import { useNoticeStore } from '../store/noticeStore';
import { useCpuSupportStore } from '../store/cpuSupportStore';
import { UNSUPPORTED_CPU_NOTICE } from '../constants/cpu-support';

const cpu = { lacksLseAtomics: false };
jest.mock('../utils/cpuSupport', () => ({
  cpuLacksLseAtomics: async () => cpu.lacksLseAtomics,
}));

afterEach(() => {
  cpu.lacksLseAtomics = false;
  useCpuSupportStore.setState({ lacksLseAtomics: false });
  useNoticeStore.setState({ notices: [] });
});

describe('useUnsupportedCpuNotice', () => {
  it('raises the unsupported-processor warning on a CPU without LSE atomics', async () => {
    cpu.lacksLseAtomics = true;
    renderHook(() => useUnsupportedCpuNotice());

    await waitFor(() =>
      expect(useNoticeStore.getState().notices).toEqual([
        UNSUPPORTED_CPU_NOTICE,
      ])
    );
  });

  it('stays silent on a supported CPU', async () => {
    renderHook(() => useUnsupportedCpuNotice());

    await waitFor(() =>
      expect(useCpuSupportStore.getState().lacksLseAtomics).toBe(false)
    );
    expect(useNoticeStore.getState().notices).toEqual([]);
  });
});
