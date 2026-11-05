const DeviceInfo = {
  getTotalMemorySync: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8 GB default
  getUsedMemory: jest.fn(() => Promise.resolve(0)),
  getDeviceId: jest.fn(() => 'iPhone17,1'),
};

export default DeviceInfo;
