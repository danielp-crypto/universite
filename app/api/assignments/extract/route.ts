import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/client";
import { extractDocumentText } from "@/lib/documents/extractText";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel rejects request bodies over 4.5 MB before they reach this route, so
// the limit is a little under that. Assignment briefs are small documents;
// larger files are almost always textbooks or scans.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Generous on purpose: the page lets the student trim the text down to its
// own limit, so a long file with a cover page and a rubric still works.
const MAX_EXTRACTED_CHARS = 60000;

const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"];

function fail(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

function extensionOf(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot === -1 ? "" : lower.slice(dot);
}

// Cheap content check so a renamed file (for example a .jpg renamed to .pdf)
// gets a clear message instead of a confusing parser error.
function looksLikeExpectedFormat(extension: string, buffer: Buffer): boolean {
  if (extension === ".pdf") {
    return buffer.subarray(0, 1024).toString("latin1").includes("%PDF-");
  }
  if (extension === ".docx" || extension === ".pptx") {
    // Both are ZIP archives, which start with "PK".
    return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  }
  return true;
}

function tidyText(text: string, method: string): string {
  let cleaned = text;

  // extractPdfText labels every page ("Page 3: ..."). That is useful for
  // slides but is just noise inside an assignment brief.
  if (method === "pdf") {
    cleaned = cleaned.replace(/^Page \d+:\s*/gm, "");
  }

  return cleaned
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return fail("unauthorized", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(authHeader.substring(7));

    if (authError || !user) {
      return fail("unauthorized", 401);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return fail("We couldn't read that upload. Please try again.", 400);
    }

    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return fail("Please choose a file to upload.", 400);
    }

    const extension = extensionOf(file.name);

    if (extension === ".doc") {
      return fail(
        "Old Word (.doc) files aren't supported. Save the file as .docx or PDF and try again.",
        415
      );
    }

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      return fail(
        "That file type isn't supported. Upload a PDF, Word (.docx), PowerPoint (.pptx) or text file, or paste the instructions instead.",
        415
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return fail(
        `That file is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 4 MB.`,
        413
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!looksLikeExpectedFormat(extension, buffer)) {
      return fail(
        `That doesn't look like a real ${extension.slice(1).toUpperCase()} file. Try saving or exporting it again.`,
        422
      );
    }

    let extracted: { text: string; method: string };

    try {
      extracted = await extractDocumentText(buffer, {
        mimeType: file.type,
        filename: file.name,
      });
    } catch (extractError) {
      const name = (extractError as { name?: string } | null)?.name;
      console.error("Assignment file extraction failed:", extractError);

      if (name === "PasswordException") {
        return fail(
          "That PDF is password-protected. Remove the password, or paste the instructions instead.",
          422
        );
      }

      return fail(
        "We couldn't read that file. Try exporting it as a PDF again, or paste the instructions instead.",
        422
      );
    }

    const fullText = tidyText(extracted.text, extracted.method);

    if (!fullText) {
      return fail(
        "We couldn't find any text in that file. If it's a scan or a photo of a page, paste the instructions instead.",
        422
      );
    }

    const truncated = fullText.length > MAX_EXTRACTED_CHARS;
    const text = truncated ? fullText.slice(0, MAX_EXTRACTED_CHARS) : fullText;

    return NextResponse.json({
      success: true,
      text,
      method: extracted.method,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      charCount: text.length,
      truncated,
    });
  } catch (error) {
    console.error("Assignment extract error:", error);
    return fail("Something went wrong reading that file. Please try again.", 500);
  }
}
