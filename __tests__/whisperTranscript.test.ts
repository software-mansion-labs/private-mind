import { withoutNonSpeechNotes } from '../utils/whisperTranscript';

describe('withoutNonSpeechNotes', () => {
  it('leaves nothing of the notes Whisper wrote for fifteen seconds of room noise on the S24', () => {
    expect(
      withoutNonSpeechNotes(
        '(speaking in foreign language) [BLANK_AUDIO] (mumbling) [inaudible]'
      )
    ).toBe('');
  });

  it('keeps the words spoken around a note', () => {
    expect(
      withoutNonSpeechNotes('Book a table for two [BLANK_AUDIO] at eight.')
    ).toBe('Book a table for two at eight.');
  });

  it('drops a square-bracket note whatever its case, as the legacy engine did', () => {
    expect(withoutNonSpeechNotes('[Music] Hello there. [MUSIC PLAYING]')).toBe(
      'Hello there.'
    );
  });

  it('keeps a parenthesis that carries dictated content rather than a sound', () => {
    expect(withoutNonSpeechNotes('Call Anna (Kraków office) tomorrow.')).toBe(
      'Call Anna (Kraków office) tomorrow.'
    );
  });

  it('does not leave a space in front of the punctuation after a dropped note', () => {
    expect(withoutNonSpeechNotes('Thanks (laughs).')).toBe('Thanks.');
  });

  it('leaves an ordinary sentence untouched', () => {
    expect(withoutNonSpeechNotes('What is the weather in Warsaw?')).toBe(
      'What is the weather in Warsaw?'
    );
  });
});
