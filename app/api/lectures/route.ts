import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import JwksClient from 'jwks-rsa';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

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

async function callSupabaseRPC(functionName: string, params: any, token: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (response.status >= 400) {
      return { error: 'rpc_failed', details: await response.text() };
    }

    return await response.json();
  } catch (error) {
    return { error: 'rpc_invalid_json', details: String(error) };
  }
}

async function executeSupabaseQuery(query: string, params: any[], token: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ query, params }),
    });

    if (response.status >= 400) {
      throw new Error(`Query failed: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Query error:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const filterType = searchParams.get('filter') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let whereClause = 'user_id = $1';
    if (filterType === 'favorites') {
      whereClause = 'user_id = $1 AND favorite = true';
    } else if (filterType === 'recent') {
      whereClause = "user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'";
    }

    const query = `
      SELECT l.*, 
             COUNT(ls.id) as segment_count
      FROM lectures l
      LEFT JOIN lecture_segments ls ON l.id = ls.lecture_id
      WHERE ${whereClause}
      GROUP BY l.id
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await executeSupabaseQuery(query, [userId, limit, offset], token);

    return NextResponse.json({
      success: true,
      lectures: result,
      filter: filterType,
      total: result.length,
    });
  } catch (error) {
    console.error('Get lectures error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
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

    const quotaResult = await callSupabaseRPC('consume_quota', { p_action: 'lecture_uploads', p_amount: 1 }, token);
    if (!quotaResult.ok) {
      return NextResponse.json({
        success: false,
        error: 'Monthly lecture upload limit exceeded',
        quota: quotaResult,
      }, { status: 429 });
    }

    const body = await request.json();
    const { title, description, duration_seconds, file_path, file_size, mime_type, status, tags } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    const query = `
      INSERT INTO lectures (user_id, title, description, duration_seconds, file_path, 
                           file_size, mime_type, status, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at, updated_at
    `;

    const params = [
      userId,
      title,
      description || null,
      duration_seconds || null,
      file_path || null,
      file_size || null,
      mime_type || null,
      status || 'processing',
      tags || [],
    ];

    const result = await executeSupabaseQuery(query, params, token);

    if (result && result.length > 0) {
      const lecture = result[0];
      return NextResponse.json({
        success: true,
        lecture: {
          id: lecture.id,
          user_id: userId,
          title,
          description,
          duration_seconds,
          file_path,
          file_size,
          mime_type,
          status: status || 'processing',
          tags: tags || [],
          created_at: lecture.created_at,
          updated_at: lecture.updated_at,
        },
        quota: quotaResult,
      });
    }

    return NextResponse.json({ success: false, error: 'Failed to create lecture' }, { status: 500 });
  } catch (error) {
    console.error('Create lecture error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
