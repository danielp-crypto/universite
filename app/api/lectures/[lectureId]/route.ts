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

export async function GET(request: NextRequest, { params }: { params: { lectureId: string } }) {
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

    const { lectureId } = params;

    const lectureQuery = `
      SELECT * FROM lectures 
      WHERE id = $1 AND user_id = $2
    `;
    const lectureResult = await executeSupabaseQuery(lectureQuery, [lectureId, userId], token);

    if (!lectureResult || lectureResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecture not found' }, { status: 404 });
    }

    const lecture = lectureResult[0];

    const segmentsQuery = `
      SELECT * FROM lecture_segments 
      WHERE lecture_id = $1 
      ORDER BY start_time_seconds
    `;
    const segmentsResult = await executeSupabaseQuery(segmentsQuery, [lectureId], token);

    return NextResponse.json({
      success: true,
      lecture,
      segments: segmentsResult,
    });
  } catch (error) {
    console.error('Get lecture error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { lectureId: string } }) {
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

    const { lectureId } = params;
    const body = await request.json();

    const checkQuery = `SELECT id FROM lectures WHERE id = $1 AND user_id = $2`;
    const checkResult = await executeSupabaseQuery(checkQuery, [lectureId, userId], token);

    if (!checkResult || checkResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecture not found' }, { status: 404 });
    }

    const updateFields: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    for (const field of ['title', 'description', 'transcription', 'summary', 'status', 'favorite']) {
      if (field in body) {
        updateFields.push(`${field} = $${paramIndex}`);
        queryParams.push(body[field]);
        paramIndex++;
      }
    }

    if (updateFields.length > 0) {
      queryParams.push(lectureId, userId);
      const query = `
        UPDATE lectures 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await executeSupabaseQuery(query, queryParams, token);

      if (result && result.length > 0) {
        return NextResponse.json({ success: true, lecture: result[0] });
      }
    }

    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    console.error('Update lecture error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { lectureId: string } }) {
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

    const { lectureId } = params;

    const checkQuery = `SELECT file_path FROM lectures WHERE id = $1 AND user_id = $2`;
    const checkResult = await executeSupabaseQuery(checkQuery, [lectureId, userId], token);

    if (!checkResult || checkResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecture not found' }, { status: 404 });
    }

    const deleteQuery = `DELETE FROM lectures WHERE id = $1 AND user_id = $2`;
    await executeSupabaseQuery(deleteQuery, [lectureId, userId], token);

    return NextResponse.json({
      success: true,
      message: 'Lecture deleted successfully',
    });
  } catch (error) {
    console.error('Delete lecture error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
