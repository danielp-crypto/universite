import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    const { id: materialId } = await params;

    const { data: material, error: fetchError } = await supabaseAdmin
      .from('study_materials')
      .select('id, user_id, file_path')
      .eq('id', materialId)
      .single();

    if (fetchError || !material) {
      return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
    }
    if (material.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
    }

    // study_material_chunks cascades automatically (on delete cascade FK).
    const { error: deleteError } = await supabaseAdmin
      .from('study_materials')
      .delete()
      .eq('id', materialId);

    if (deleteError) {
      console.error('Error deleting study material:', deleteError);
      return NextResponse.json({ success: false, error: 'delete_failed' }, { status: 500 });
    }

    if (material.file_path) {
      const { error: storageError } = await supabaseAdmin.storage.from('lecture-media').remove([material.file_path]);
      if (storageError) {
        console.error('Error deleting study material file from storage:', storageError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Study material delete error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}