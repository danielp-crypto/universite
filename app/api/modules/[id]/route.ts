import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const { id: moduleId } = await params;
    const body = await request.json();
    const { name, description, color } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;

    const { data: module, error } = await supabaseAdmin
      .from('modules')
      .update(updateData)
      .eq('id', moduleId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !module) {
      return NextResponse.json({ success: false, error: 'update_failed' }, { status: 500 });
    }

    return NextResponse.json(module);
  } catch (error) {
    console.error('Update module error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const { id: moduleId } = await params;

    const { error } = await supabaseAdmin
      .from('modules')
      .delete()
      .eq('id', moduleId)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete module error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}
