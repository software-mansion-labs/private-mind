export const createLLMRunner = jest.fn();
export const createChatPreprocessor = jest.fn();
export const parseTokenizerConfig = jest.fn(() => ({
  chatTemplate: '',
  eosToken: '</s>',
  stopTokens: ['</s>'],
}));
