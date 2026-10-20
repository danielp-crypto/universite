import JSZip from 'jszip';

// Extracts plain text from a PDF, page by page. PowerPoint-exported PDFs
// (the overwhelming majority of "slides as PDF" uploads) always retain a
// text layer even for visually-laid-out slides, so this works well for the
// common case without needing OCR or multimodal AI calls.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const runtimeGlobals = globalThis as any;
  runtimeGlobals.DOMMatrix ||= class DOMMatrix {};
  runtimeGlobals.ImageData ||= class ImageData {};
  runtimeGlobals.Path2D ||= class Path2D {};
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js runs "in the main thread" on the server and normally loads its
  // worker file with a dynamic import of './pdf.worker.mjs' next to itself.
  // Once Next bundles pdf.mjs into a server chunk, that sibling file no longer
  // exists ("Setting up fake worker failed: Cannot find module .../chunks/
  // pdf.worker.mjs"), so every PDF failed. Importing the worker explicitly
  // makes the bundler include it, and pdf.js uses a worker already present on
  // globalThis.pdfjsWorker instead of trying to load one from disk.
  if (!runtimeGlobals.pdfjsWorker) {
    // @ts-expect-error -- pdfjs-dist ships no type declarations for the worker entry
    runtimeGlobals.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  }
  const document = await getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as any).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (text) pages.push(`Page ${pageNumber}: ${text}`);
  }
  return pages.join('\n\n').trim();
}

// A .pptx file is a ZIP archive of XML files, one per slide
// (ppt/slides/slide1.xml, slide2.xml, ...). Each slide's text runs live in
// <a:t> tags. This pulls out just the text — diagrams/images without text
// aren't captured, but slide titles, bullets, and body text all are, which
// covers the large majority of what's actually useful as study context.
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)![1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)![1], 10);
      return numA - numB;
    });

  const slideTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string');
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)];
    const text = matches.map((m) => m[1]).join(' ').trim();
    if (text) {
      slideTexts.push(`Slide ${i + 1}: ${text}`);
    }
  }

  return slideTexts.join('\n\n');
}

// A .docx file is also a ZIP archive. The body lives in word/document.xml:
// text runs are <w:t> tags, and </w:p> ends a paragraph. Tables, headers and
// footnotes are separate parts; table cell text is inside document.xml, so it
// is included, with cells separated by a tab and one table row per line.
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.files['word/document.xml'];

  if (!entry) {
    throw new Error('This does not look like a valid Word (.docx) file.');
  }

  const xml = await entry.async('string');
  const tokenPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<\/w:p>|<w:br[^>]*\/>|<w:tab[^>]*\/>|<\/w:tc>|<\/w:tr>/g;
  const parts: string[] = [];

  for (const match of xml.matchAll(tokenPattern)) {
    const token = match[0];

    if (match[1] !== undefined) {
      parts.push(decodeXmlEntities(match[1]));
    } else if (token === '</w:p>' || token.startsWith('<w:br')) {
      parts.push('\n');
    } else if (token === '</w:tc>') {
      // A cell's last paragraph already added a newline; a cell boundary
      // should be a tab instead, so a row stays on one line.
      if (parts[parts.length - 1] === '\n') parts.pop();
      parts.push('\t');
    } else if (token === '</w:tr>') {
      if (parts[parts.length - 1] === '\t') parts.pop();
      parts.push('\n');
    } else {
      parts.push('\t');
    }
  }

  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Study materials also commonly come as plain lecture notes — .txt or .md
// need no real extraction, just UTF-8 decoding.
export function extractPlainText(buffer: Buffer): string {
  return buffer.toString('utf-8').trim();
}

export interface ExtractTextResult {
  text: string;
  method: 'pdf' | 'pptx' | 'docx' | 'plain';
}

// Picks the right extractor based on mime type / filename, used by both the
// lecture-slides route and the study-materials route so there's exactly one
// implementation of each format's extraction logic.
export async function extractDocumentText(
  buffer: Buffer,
  { mimeType, filename }: { mimeType?: string; filename: string }
): Promise<ExtractTextResult> {
  const lowerName = filename.toLowerCase();
  const isPptx = mimeType?.includes('presentation') || lowerName.endsWith('.pptx');
  const isDocx = mimeType?.includes('wordprocessingml') || lowerName.endsWith('.docx');
  const isPlainText = mimeType?.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');

  if (isPptx) {
    return { text: await extractPptxText(buffer), method: 'pptx' };
  }
  if (isDocx) {
    return { text: await extractDocxText(buffer), method: 'docx' };
  }
  if (isPlainText) {
    return { text: extractPlainText(buffer), method: 'plain' };
  }
  return { text: await extractPdfText(buffer), method: 'pdf' };
}