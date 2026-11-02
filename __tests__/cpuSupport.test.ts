import { cpuinfoLacksLseAtomics } from '../utils/cpuSupport';

const core = (index: number, features: string, part: string) =>
  [
    `processor\t: ${index}`,
    'BogoMIPS\t: 26.00',
    `Features\t: ${features}`,
    'CPU implementer\t: 0x41',
    'CPU architecture: 8',
    'CPU variant\t: 0x0',
    `CPU part\t: ${part}`,
    '',
  ].join('\n');

const ARMV80 = 'fp asimd evtstrm aes pmull sha1 sha2 crc32 cpuid';
const ARMV82 =
  'fp asimd evtstrm aes pmull sha1 sha2 crc32 atomics fphp asimdhp cpuid asimdrdm lrcpc dcpop asimddp';

describe('cpuinfoLacksLseAtomics', () => {
  it('flags a Cortex-A53/A73 phone, whose cores have no LSE atomics', () => {
    const helioP35 = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((index) => core(index, ARMV80, index < 4 ? '0xd03' : '0xd09'))
      .join('\n');
    expect(cpuinfoLacksLseAtomics(helioP35)).toBe(true);
  });

  it('passes an ARMv8.2 phone, whose every core lists atomics', () => {
    const cortexA55A76 = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((index) => core(index, ARMV82, index < 6 ? '0xd05' : '0xd0b'))
      .join('\n');
    expect(cpuinfoLacksLseAtomics(cortexA55A76)).toBe(false);
  });

  it('flags a CPU where only some cores list atomics', () => {
    const mixed = core(0, ARMV82, '0xd05') + '\n' + core(1, ARMV80, '0xd03');
    expect(cpuinfoLacksLseAtomics(mixed)).toBe(true);
  });

  it('does not mistake a feature that merely contains the word for atomics', () => {
    expect(
      cpuinfoLacksLseAtomics(core(0, `${ARMV80} noatomics`, '0xd03'))
    ).toBe(true);
  });

  it('passes an x86 emulator, whose cpuinfo has flags instead of Features', () => {
    const x86 =
      'processor\t: 0\nvendor_id\t: GenuineIntel\nflags\t\t: fpu vme de pse\n';
    expect(cpuinfoLacksLseAtomics(x86)).toBe(false);
  });

  it('passes when cpuinfo is empty', () => {
    expect(cpuinfoLacksLseAtomics('')).toBe(false);
  });
});
