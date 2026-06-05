import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import JwksClient from 'jwks-rsa';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || '';
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/distilgpt2';

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

    const quotaResult = await consumeQuota('flashcard_generations', 1, token);
    if (!quotaResult.ok) {
      return NextResponse.json({ success: false, error: 'quota_check_failed', details: quotaResult }, { status: 503 });
    }

    const body = await request.json();
    const { lecture } = body;

    const prompt = `Based on this lecture content, generate 10-15 educational flashcards in JSON format.

Lecture Title: ${lecture?.title || 'Unknown'}
Key Concepts: ${(lecture?.keyConcepts || []).join(', ')}
Segments: ${(lecture?.segments || []).map((s: any) => s.title || '').join(', ')}

Generate flashcards as a JSON array with this structure:
[
  {"question": "What is...?", "answer": "The answer is...", "category": "concept name"},
  ...
]

Return ONLY the JSON array, no other text.`;

    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 1000,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          return_full_text: false,
        },
      }),
    });

    if (response.status !== 200) {
      return NextResponse.json({ success: false, error: 'Failed to generate flashcards' }, { status: response.status });
    }

    const result = await response.json();
    if (Array.isArray(result) && result.length > 0) {
      const responseText = result[0]?.generated_text || '';
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        const flashcards = JSON.parse(jsonMatch[0]);
        return NextResponse.json({ success: true, flashcards });
      }
    }

    return NextResponse.json({ success: false, error: 'Failed to parse flashcards' }, { status: 500 });
  } catch (error) {
    console.error('Flashcards error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
