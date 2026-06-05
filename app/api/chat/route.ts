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

    const quotaResult = await consumeQuota('chat_messages', 1, token);
    if (!quotaResult.ok) {
      return NextResponse.json({ success: false, error: 'quota_check_failed', details: quotaResult }, { status: 503 });
    }

    const body = await request.json();
    const { message, currentLecture, messages = [] } = body;

    let systemPrompt = 'You are an AI learning assistant helping students study their lecture content. ';

    if (currentLecture) {
      systemPrompt += `
Current Lecture Information:
Title: ${currentLecture.title || 'Unknown'}
Date: ${currentLecture.date || 'Unknown'}
Duration: ${currentLecture.duration || 'Unknown'}
Key Concepts: ${(currentLecture.keyConcepts || []).join(', ')}
Segments:
${(currentLecture.segments || []).map((s: any) => `- ${s.title || 'Unknown'} (${s.startTime || 'Unknown'}): ${(s.concepts || []).join(', ')}`).join('\n')}

Use this lecture information to provide contextually relevant responses.`;
    } else {
      systemPrompt += '\n\nNo lecture content is available yet. Please guide the user to record or upload a lecture.';
    }

    let conversationHistory = '';
    if (messages.length > 0) {
      const recentMessages = messages.slice(-6);
      conversationHistory = '\n\nRecent conversation:\n';
      recentMessages.forEach((msg: any) => {
        const senderLabel = msg.sender === 'user' ? 'Student' : 'Assistant';
        conversationHistory += `${senderLabel}: ${msg.content || ''}\n`;
      });
    }

    const fullPrompt = systemPrompt + conversationHistory + `\n\nStudent: ${message}\nAssistant:`;

    const response = await fetch(HUGGINGFACE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_length: 500,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          return_full_text: false,
        },
      }),
    });

    if (response.status !== 200) {
      return NextResponse.json({ success: false, error: 'Hugging Face API error' }, { status: 500 });
    }

    const result = await response.json();
    if (Array.isArray(result) && result.length > 0) {
      const responseText = result[0]?.generated_text || '';
      return NextResponse.json({ success: true, response: responseText.trim() });
    }

    return NextResponse.json({ success: false, error: 'Failed to parse response' }, { status: 500 });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
