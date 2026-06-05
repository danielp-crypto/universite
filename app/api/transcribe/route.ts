import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import JwksClient from 'jwks-rsa';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

let jwksClient: any = null;

function getJwksClient() {
  if (!jwksClient) {
    if (!SUPABASE_URL) {
      throw new Error('SUPABASE_URL is not set');
    }
    jwksClient = JwksClient({
      jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    });
  }
  return jwksClient;
}

async function verifyToken(token: string) {
  try {
    const unverified = jwt.decode(token, { complete: true }) as any;
    const alg = unverified?.header?.alg || 'RS256';

    let signingKey: string;
    if (alg === 'HS256') {
      signingKey = SUPABASE_ANON_KEY;
    } else {
      const client = getJwksClient();
      const key = await client.getSigningKey(unverified.header.kid);
      signingKey = key.getPublicKey();
    }

    const decoded = jwt.verify(token, signingKey, {
      algorithms: [alg],
      issuer: `${SUPABASE_URL}/auth/v1`,
    }) as any;

    return decoded.sub;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

async function consumeQuota(action: string, amount: number = 1, token: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_quota`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_action: action, p_amount: amount }),
    });

    if (response.status >= 400) {
      return { ok: false, error: 'quota_rpc_failed' };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return { ok: false, error: 'quota_rpc_failed' };
  }
}

async function transcribeAudio(audioBuffer: Buffer, contentType: string): Promise<string> {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not set');
  }

  const formData = new FormData();
  let filename = 'audio';
  
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('wav')) filename += '.wav';
    else if (ct.includes('mp3')) filename += '.mp3';
    else if (ct.includes('webm')) filename += '.webm';
    else if (ct.includes('flac')) filename += '.flac';
    else filename += '.audio';
  }

  formData.append('file', new Blob([audioBuffer], { type: contentType || 'audio/wav' }), filename);

  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    punctuate: 'true',
    utterances: 'true',
  });

  const maxRetries = 3;
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${DEEPGRAM_API_URL}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
        body: formData,
      });

      if (response.status === 200) {
        const result = await response.json();
        if (result.results && result.results.length > 0) {
          const transcripts = result.results
            .map((r: any) => r.alternatives?.[0]?.transcript || '')
            .filter((t: string) => t);
          return transcripts.join(' ').trim();
        }
        return '';
      } else {
        lastError = `Deepgram API error: ${response.status} - ${await response.text()}`;
      }
    } catch (error) {
      lastError = String(error);
    }

    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Transcription failed after ${maxRetries} attempts: ${lastError}`);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'missing_auth' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userId = await verifyToken(token);

    if (!userId) {
      return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 401 });
    }

    const quotaResult = await consumeQuota('lecture_uploads', 1, token);
    if (quotaResult.ok === false) {
      return NextResponse.json({
        success: false,
        error: 'quota_exceeded',
        message: 'Monthly lecture upload limit reached.',
        quota: quotaResult,
      }, { status: 402 });
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ success: false, error: 'missing_audio' }, { status: 400 });
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    if (audioBuffer.length === 0) {
      return NextResponse.json({ success: false, error: 'empty_audio' }, { status: 400 });
    }

    const contentType = audioFile.type || '';

    try {
      const transcript = await transcribeAudio(audioBuffer, contentType);

      if (!transcript) {
        return NextResponse.json({
          success: false,
          error: 'No speech detected in audio.',
        }, { status: 422 });
      }

      return NextResponse.json({
        success: true,
        transcript,
      });
    } catch (error: any) {
      if (error.message.includes('DEEPGRAM_API_KEY')) {
        return NextResponse.json({
          success: false,
          error: 'Transcription not configured. Set DEEPGRAM_API_KEY to your Deepgram API key.',
        }, { status: 503 });
      }
      return NextResponse.json({
        success: false,
        error: 'Transcription failed.',
        detail: error.message,
      }, { status: 502 });
    }
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
