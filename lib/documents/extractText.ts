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

// Study materials also commonly come as plain lecture notes — .txt or .md
// need no real extraction, just UTF-8 decoding.
export function extractPlainText(buffer: Buffer): string {
  return buffer.toString('utf-8').trim();
}

export interface ExtractTextResult {
  text: string;
  method: 'pdf' | 'pptx' | 'plain';
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
  const isPlainText = mimeType?.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');

  if (isPptx) {
    return { text: await extractPptxText(buffer), method: 'pptx' };
  }
  if (isPlainText) {
    return { text: extractPlainText(buffer), method: 'plain' };
  }
  return { text: await extractPdfText(buffer), method: 'pdf' };
}