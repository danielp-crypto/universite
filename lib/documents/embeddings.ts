const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

// gemini-embedding-001's real limit is 2048 input tokens per text. There's
// no exact char-to-token ratio, but English text averages under 4 chars per
// token, so 3000 chars stays comfortably under that even for token-dense
// text (equations, code, dense terminology) — safer than cutting it close.
const CHUNK_SIZE_CHARS = 3000;
const CHUNK_OVERLAP_CHARS = 300;

// Hard ceiling on how many chunks one document can produce. At ~3000 chars/
// chunk this is roughly a 150-200 page document's worth of text — far more
// than a typical study guide or lecture note set. Exists so one huge upload
// (a whole textbook, say) can't single-handedly blow past the 60s function
// budget or produce an unreasonable number of embedding API calls; the
// document still gets processed, just truncated, and the caller is told so
// rather than the request silently timing out.
const MAX_CHUNKS_PER_DOCUMENT = 300;

// How many chunks go into a single batchEmbedContents call. Keeps each
// request's payload and response reasonably sized rather than one huge call
// for a large document.
const EMBED_BATCH_SIZE = 20;

export interface TextChunk {
  index: number;
  content: string;
}

// Splits text into overlapping chunks, preferring to break on paragraph
// boundaries (blank lines) so a chunk doesn't split a sentence mid-thought
// when it can reasonably avoid it. Falls back to a hard character cut for
// any single paragraph longer than the chunk size itself.
export function chunkText(text: string): { chunks: TextChunk[]; truncated: boolean } {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks: TextChunk[] = [];
  let current = '';

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push({ index: chunks.length, content: trimmed });
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) break;

    if (paragraph.length > CHUNK_SIZE_CHARS) {
      // A single paragraph longer than one chunk — hard-slice it with
      // overlap rather than let it blow the chunk size limit.
      pushCurrent();
      let start = 0;
      while (start < paragraph.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
        const end = Math.min(start + CHUNK_SIZE_CHARS, paragraph.length);
        chunks.push({ index: chunks.length, content: paragraph.slice(start, end).trim() });
        start = end - CHUNK_OVERLAP_CHARS;
        if (start <= 0 || end >= paragraph.length) break;
      }
      continue;
    }

    if ((current + '\n\n' + paragraph).length > CHUNK_SIZE_CHARS) {
      pushCurrent();
      // Carry a bit of overlap from the end of the previous chunk into the
      // next one, so context isn't lost right at a chunk boundary.
      const overlapSource = chunks[chunks.length - 1]?.content || '';
      current = overlapSource.slice(-CHUNK_OVERLAP_CHARS);
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  if (chunks.length < MAX_CHUNKS_PER_DOCUMENT) pushCurrent();

  const truncated = chunks.length >= MAX_CHUNKS_PER_DOCUMENT;
  return { chunks: chunks.slice(0, MAX_CHUNKS_PER_DOCUMENT), truncated };
}

// L2-normalizes an embedding vector. Required for gemini-embedding-001 at
// any output_dimensionality other than the full 3072 — only the full-size
// output is pre-normalized by the API itself. Skipping this silently
// corrupts cosine-similarity search results (magnitude bleeds into what
// should be a pure direction comparison).
function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

async function callBatchEmbed(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini batchEmbedContents failed (${response.status}): ${errorText || '(no response body)'}`);
  }

  const data = await response.json();
  const embeddings = data.embeddings as { values: number[] }[] | undefined;
  if (!embeddings || embeddings.length !== texts.length) {
    throw new Error('Gemini batchEmbedContents returned an unexpected number of embeddings');
  }

  return embeddings.map((e) => normalize(e.values));
}

// Embeds an array of document chunks for storage, in batches. Order of
// returned vectors matches the order of the input chunks.
export async function embedDocumentChunks(chunks: string[]): Promise<number[][]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const results: number[][] = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    const batchEmbeddings = await callBatchEmbed(batch, 'RETRIEVAL_DOCUMENT');
    results.push(...batchEmbeddings);
  }
  return results;
}

// Embeds a single query string (a student's chat message, or a weak-topic
// name) for similarity search against stored document chunks.
export async function embedQuery(query: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const [embedding] = await callBatchEmbed([query], 'RETRIEVAL_QUERY');
  return embedding;
}