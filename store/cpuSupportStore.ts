import { create } from 'zustand';
import { cpuLacksLseAtomics } from '../utils/cpuSupport';

interface CpuSupportStore {
  lacksLseAtomics: boolean;
  checkCpu: () => Promise<void>;
}

export const useCpuSupportStore = create<CpuSupportStore>((set) => ({
  lacksLseAtomics: false,
  checkCpu: async () => set({ lacksLseAtomics: await cpuLacksLseAtomics() }),
}));
