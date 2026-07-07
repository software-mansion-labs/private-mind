import { readDocumentText, normalizePdfText } from '../utils/fileReaders';
import { readPDF } from 'react-native-pdfium';
import { File } from 'expo-file-system';

const mockReadPDF = readPDF as jest.Mock;
const MockFile = File as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  MockFile.mockImplementation(() => ({ text: jest.fn() }));
});

describe('readDocumentText — PDF', () => {
  it('strips file:// prefix before passing path to readPDF', async () => {
    mockReadPDF.mockResolvedValue('pdf content');
    await readDocumentText('file:///path/to/doc.pdf', 'pdf');
    expect(mockReadPDF).toHaveBeenCalledWith('/path/to/doc.pdf');
  });

  it('passes path without prefix unchanged', async () => {
    mockReadPDF.mockResolvedValue('pdf content');
    await readDocumentText('/local/path/doc.pdf', 'pdf');
    expect(mockReadPDF).toHaveBeenCalledWith('/local/path/doc.pdf');
  });

  it('returns the text from readPDF', async () => {
    mockReadPDF.mockResolvedValue('extracted text');
    const result = await readDocumentText('file:///doc.pdf', 'pdf');
    expect(result).toBe('extracted text');
  });

  it('is case-insensitive for file type', async () => {
    mockReadPDF.mockResolvedValue('text');
    await readDocumentText('file:///doc.pdf', 'PDF');
    expect(mockReadPDF).toHaveBeenCalled();
  });
});

describe('readDocumentText — TXT / MD', () => {
  it('reads txt files via File.text()', async () => {
    const mockText = jest.fn().mockResolvedValue('plain text');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('file:///note.txt', 'txt');
    expect(MockFile).toHaveBeenCalledWith('file:///note.txt');
    expect(result).toBe('plain text');
  });

  it('reads md files via File.text()', async () => {
    const mockText = jest.fn().mockResolvedValue('# heading');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/docs/readme.md', 'md');
    expect(result).toBe('# heading');
  });

  it('reads markdown alias via File.text()', async () => {
    const mockText = jest.fn().mockResolvedValue('content');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/file.markdown', 'markdown');
    expect(result).toBe('content');
  });
});

describe('readDocumentText — HTML', () => {
  it('strips basic HTML tags', async () => {
    const mockText = jest.fn().mockResolvedValue('<p>Hello <b>world</b></p>');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.html', 'html');
    // Tags are replaced with spaces then whitespace is normalised — "Hello  world" → "Hello world"
    expect(result).toBe('Hello world');
  });

  it('removes <script> blocks entirely', async () => {
    const mockText = jest
      .fn()
      .mockResolvedValue('<script>alert("xss")</script><p>content</p>');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.html', 'html');
    expect(result).not.toContain('alert');
    expect(result).toContain('content');
  });

  it('removes <style> blocks entirely', async () => {
    const mockText = jest
      .fn()
      .mockResolvedValue('<style>.foo { color: red; }</style><p>text</p>');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.html', 'html');
    expect(result).not.toContain('color');
    expect(result).toContain('text');
  });

  it('decodes HTML entities', async () => {
    const mockText = jest
      .fn()
      .mockResolvedValue(
        '<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; f&nbsp;g</p>'
      );
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.html', 'html');
    expect(result).toContain('a & b <c> "d" \'e\' f g');
  });

  it('normalizes multiple whitespace into single spaces', async () => {
    const mockText = jest.fn().mockResolvedValue('<p>a   b\n\nc</p>');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.html', 'html');
    expect(result).toBe('a b c');
  });

  it('handles htm extension', async () => {
    const mockText = jest.fn().mockResolvedValue('<p>htm</p>');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/page.htm', 'htm');
    expect(result).toBe('htm');
  });
});

describe('readDocumentText — unsupported types', () => {
  it('throws for unsupported file type', async () => {
    await expect(readDocumentText('/file.docx', 'docx')).rejects.toThrow(
      'Unsupported file type: docx'
    );
  });
});

describe('readDocumentText — CSV', () => {
  it('reads csv files as text via File.text()', async () => {
    const mockText = jest.fn().mockResolvedValue('a,b,c\n1,2,3');
    MockFile.mockImplementation(() => ({ text: mockText }));

    const result = await readDocumentText('/data.csv', 'csv');
    expect(MockFile).toHaveBeenCalledWith('/data.csv');
    expect(result).toBe('a,b,c\n1,2,3');
  });
});

describe('normalizePdfText', () => {
  it('collapses single soft-wrap line breaks into spaces', () => {
    expect(normalizePdfText('Sta\nwka\nVAT')).toBe('Sta wka VAT');
  });

  it('rejoins wrapped multi-word headers', () => {
    expect(normalizePdfText('Cena brutto\n[zł]')).toBe('Cena brutto [zł]');
  });

  it('preserves paragraph breaks between blocks', () => {
    expect(normalizePdfText('Block one.\n\n\nBlock two.')).toBe(
      'Block one.\n\nBlock two.'
    );
  });

  it('rejoins a word split by a hyphen at a line break', () => {
    expect(normalizePdfText('structured e-\ninvoice')).toBe(
      'structured einvoice'
    );
  });

  it('strips control and format characters (soft hyphen, zero-width space)', () => {
    const softHyphen = String.fromCharCode(0x00ad);
    const zeroWidth = String.fromCharCode(0x200b);
    const input = `e${softHyphen}invoice a${zeroWidth}b`;
    expect(normalizePdfText(input)).toBe('einvoice ab');
  });

  it('leaves already-clean single-line text unchanged', () => {
    expect(normalizePdfText('extracted text')).toBe('extracted text');
  });

  it('applies to text read from a PDF', async () => {
    mockReadPDF.mockResolvedValue('Cena brutto\n[zł]\nWartość');
    const result = await readDocumentText('file:///doc.pdf', 'pdf');
    expect(result).toBe('Cena brutto [zł] Wartość');
  });
});
