const loadWithNativeModule = (nativeModule: unknown) => {
  jest.resetModules();
  jest.doMock('expo', () => ({
    requireOptionalNativeModule: () => nativeModule,
  }));
  return require('../modules/display-corners') as typeof import('../modules/display-corners');
};

describe('getDisplayCornerRadius', () => {
  it('returns the radius the platform reports', async () => {
    const { getDisplayCornerRadius } = loadWithNativeModule({
      getCornerRadius: () => Promise.resolve(62),
    });

    await expect(getDisplayCornerRadius()).resolves.toBe(62);
  });

  it('keeps corners straight when the native module is missing', async () => {
    const { getDisplayCornerRadius } = loadWithNativeModule(null);

    await expect(getDisplayCornerRadius()).resolves.toBe(0);
  });

  it('keeps corners straight when the native read fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { getDisplayCornerRadius } = loadWithNativeModule({
      getCornerRadius: () => Promise.reject(new Error('no window')),
    });

    await expect(getDisplayCornerRadius()).resolves.toBe(0);
    warn.mockRestore();
  });
});
