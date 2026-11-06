const HUGGING_FACE_FILE_URL =
  /^https:\/\/huggingface\.co\/([^/]+)\/([^/]+)\/resolve\//;

export const huggingFaceRepoUrl = (fileUrl: string): string | undefined => {
  const match = HUGGING_FACE_FILE_URL.exec(fileUrl);
  return match ? `https://huggingface.co/${match[1]}/${match[2]}` : undefined;
};
