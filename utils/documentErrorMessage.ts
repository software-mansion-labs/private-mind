export const documentErrorMessage = (result: {
  reason?: 'scanned_pdf';
  isEmpty?: boolean;
}): string => {
  if (result.reason === 'scanned_pdf') {
    return 'This PDF has no selectable text — it looks scanned, so it can’t be read yet. Try a text-based PDF.';
  }
  if (result.isEmpty) {
    return 'Document appears to be empty.';
  }
  return 'Failed to process document.';
};
