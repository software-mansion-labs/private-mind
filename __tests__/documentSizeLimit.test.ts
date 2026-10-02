import {
  isTooLargeToRead,
  MAX_TEXT_DOCUMENT_BYTES,
} from '../utils/documentSizeLimit';

describe('isTooLargeToRead', () => {
  it('refuses a text file too large to read whole into memory', () => {
    expect(isTooLargeToRead('csv', MAX_TEXT_DOCUMENT_BYTES + 1)).toBe(true);
  });

  it('takes a text file within the limit', () => {
    expect(isTooLargeToRead('txt', MAX_TEXT_DOCUMENT_BYTES)).toBe(false);
  });

  it('leaves a large PDF alone, since its text is extracted natively', () => {
    expect(isTooLargeToRead('pdf', 50 * 1024 * 1024)).toBe(false);
  });

  it('takes a file whose size the picker did not report', () => {
    expect(isTooLargeToRead('txt', undefined)).toBe(false);
  });
});
