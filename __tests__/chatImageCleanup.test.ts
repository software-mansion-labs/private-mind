import { removeImagesNoMessageUses } from '../utils/persistImage';

const mockDeleted: string[] = [];
let mockStored: string[] = [];

jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///documents/' } },
  File: jest.fn(),
  Directory: jest.fn().mockImplementation(() => ({
    exists: true,
    list: () =>
      mockStored.map((name) => ({
        uri: `file:///documents/chat-images/${name}`,
        delete: () => mockDeleted.push(name),
      })),
  })),
}));

jest.mock('../utils/modelReadableImage', () => ({
  toModelReadableImage: jest.fn(),
}));

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  mockDeleted.length = 0;
});

describe('removeImagesNoMessageUses', () => {
  it('deletes the photos of a deleted chat and keeps those another chat still shows', () => {
    mockStored = [
      `img-${NOW - HOUR}-aaaaaa.jpg`,
      `img-${NOW - HOUR}-bbbbbb.jpg`,
    ];

    removeImagesNoMessageUses(
      [
        `file:///var/old-container/Documents/chat-images/img-${NOW - HOUR}-bbbbbb.jpg`,
      ],
      NOW
    );

    expect(mockDeleted).toEqual([`img-${NOW - HOUR}-aaaaaa.jpg`]);
  });

  it('keeps a photo saved moments ago for a message that is still being sent', () => {
    mockStored = [`img-${NOW - 5_000}-cccccc.jpg`];

    removeImagesNoMessageUses([], NOW);

    expect(mockDeleted).toEqual([]);
  });

  it('leaves files it did not save alone', () => {
    mockStored = ['notes.txt'];

    removeImagesNoMessageUses([], NOW);

    expect(mockDeleted).toEqual([]);
  });
});
