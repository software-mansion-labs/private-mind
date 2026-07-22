import { readPDF } from 'react-native-pdfium';
import { File } from 'expo-file-system';
import { extractArticle } from './web/url/extractArticle';

const stripHtml = (html: string): string =>
  html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const stripInvisibleChars = (text: string): string =>
  text.replace(/[\p{Cc}\p{Cf}\uFFF9-\uFFFF]/gu, (ch) =>
    ch === '\n' || ch === '\t' ? ch : ''
  );

const rejoinHyphenatedWords = (text: string): string =>
  text.replace(/(\p{Ll})[-\u2010\u2011]\n(\p{Ll})/gu, '$1$2');

const collapseBlankLines = (text: string): string =>
  text.replace(/[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');

const unwrapSoftLineBreaks = (text: string): string =>
  text.replace(/([^\n])\n(?!\n)/g, '$1 ');

const tidyWhitespace = (text: string): string =>
  text.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n');

// PDF extraction leaks layout artifacts (hyphen-split words, hard-wrapped
// lines, invisible control characters) that break retrieval and citations.
export const normalizePdfText = (raw: string): string => {
  const stripped = stripInvisibleChars(raw);
  const rejoined = rejoinHyphenatedWords(stripped);
  const collapsed = collapseBlankLines(rejoined);
  const unwrapped = unwrapSoftLineBreaks(collapsed);
  return tidyWhitespace(unwrapped).trim();
};

export async function readDocumentText(
  filePath: string,
  fileExtension: string
): Promise<string> {
  switch (fileExtension.toLowerCase()) {
    case 'pdf': {
      const normalizedPath = filePath.replace('file://', '');
      const rawText = await readPDF(normalizedPath);
      return normalizePdfText(rawText);
    }

    case 'txt':
    case 'md':
    case 'markdown':
    case 'csv': {
      const textFile = new File(filePath);
      return await textFile.text();
    }

    case 'html':
    case 'htm': {
      const htmlFile = new File(filePath);
      const htmlContent = await htmlFile.text();
      return stripHtml(htmlContent);
    }

    case 'url': {
      const article = await extractArticle(filePath);
      return article.text;
    }

    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
}
