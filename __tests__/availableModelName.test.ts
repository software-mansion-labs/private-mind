import { availableModelName } from '../utils/availableModelName';

describe('availableModelName', () => {
  it('keeps a name nobody uses', () => {
    expect(availableModelName('llama', ['qwen'])).toBe('llama');
  });

  it('numbers a name that is taken, ignoring letter case', () => {
    expect(availableModelName('Model', ['model', 'model 2'])).toBe('Model 3');
  });
});
