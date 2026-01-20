import { readPDF } from 'react-native-pdfium';
import { File } from 'expo-file-system';

/**
 * Reads text content from various file formats
 * @param filePath - The path to the file
 * @param fileType - The file extension (pdf, txt, md, html, csv, etc.)
 * @returns The extracted text content
 */
export async function readDocumentText(
  filePath: string,
  fileType: string
): Promise<string> {
  const lowerFileType = fileType.toLowerCase();

  switch (lowerFileType) {
    case 'pdf':
      // PDF reader needs path without file:// prefix
      const normalizedPath = filePath.replace('file://', '');
      return await readPDF(normalizedPath);

    case 'txt':
    case 'md':
    case 'markdown':
      const textFile = new File(filePath);
      return await textFile.text();

    case 'html':
    case 'htm':
      const htmlFile = new File(filePath);
      const htmlContent = await htmlFile.text();
      // Basic HTML tag stripping - removes all HTML tags
      return htmlContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
        .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
