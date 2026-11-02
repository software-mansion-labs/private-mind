export const IMAGE_ONLY_QUESTION = 'What is in this picture?';

export const questionForImage = (content: string): string =>
  content.trim() || IMAGE_ONLY_QUESTION;
