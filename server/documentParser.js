import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';

const textExtensions = new Set(['.txt', '.md', '.csv', '.json', '.js', '.ts', '.html', '.css']);

function safeCut(text = '', max = 35000) {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

async function parsePptx(filePath) {
  return `PPTX uploaded: ${path.basename(filePath)}. For richer extraction, integrate a dedicated PPTX parser.`;
}

export async function extractTextFromFile(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();

  if (textExtensions.has(ext)) {
    return safeCut(await fs.readFile(filePath, 'utf-8'));
  }
  if (ext === '.pdf' || mimeType?.includes('pdf')) {
    const parsed = await pdf(await fs.readFile(filePath));
    return safeCut(parsed.text);
  }
  if (ext === '.docx' || mimeType?.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ path: filePath });
    return safeCut(result.value);
  }
  if (ext === '.pptx' || mimeType?.includes('presentationml')) {
    return safeCut(await parsePptx(filePath));
  }

  return `Uploaded file ${path.basename(filePath)} (${mimeType || 'unknown type'}). This type is stored and can still be used as a reference.`;
}
