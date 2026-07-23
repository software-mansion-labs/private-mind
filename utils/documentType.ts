import { SPREADSHEET_DOC_TYPES } from '../constants/documents';

export const getDocumentType = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === name.length - 1) return '';
  return name.slice(lastDot + 1).toUpperCase();
};

export const isSpreadsheetType = (docType: string): boolean =>
  SPREADSHEET_DOC_TYPES.has(docType);
