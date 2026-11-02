import { useEffect } from 'react';
import { useCpuSupportStore } from '../store/cpuSupportStore';
import { useNoticeStore } from '../store/noticeStore';
import { UNSUPPORTED_CPU_NOTICE } from '../constants/cpu-support';

export const useUnsupportedCpuNotice = () => {
  const lacksLseAtomics = useCpuSupportStore((state) => state.lacksLseAtomics);
  const checkCpu = useCpuSupportStore((state) => state.checkCpu);
  const showNotice = useNoticeStore((state) => state.showNotice);

  useEffect(() => {
    checkCpu();
  }, [checkCpu]);

  useEffect(() => {
    if (lacksLseAtomics) showNotice(UNSUPPORTED_CPU_NOTICE);
  }, [lacksLseAtomics, showNotice]);
};
