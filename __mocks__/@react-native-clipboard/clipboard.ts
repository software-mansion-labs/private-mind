const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
};

export default Clipboard;
