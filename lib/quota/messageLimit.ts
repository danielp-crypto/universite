import { supabaseAdmin } from '@/lib/supabase/client';

// Per-conversation message limits (tutor messages per lecture, coach messages
// per assignment).
//
// A plain "count the messages, then insert" check can be beaten by sending
// many requests at once: each one counts 9, so all of them pass. This helper
// closes that gap by reserving the slot FIRST: the student's message is saved
// before the AI is called, then ranked against the messages that were saved
// before it. Only the first `limit` messages by (created_at, id) keep their
// slot, however the requests interleave; any later one is deleted again and
// refused. If the AI call then fails, the caller releases the slot so a
// failed reply never costs the student a message.

type MessageTable = 'chat_messages' | 'assignment_messages';
type ScopeColumn = 'lecture_id' | 'assignment_id';

interface ReserveOptions {
  table: MessageTable;
  scopeColumn: ScopeColumn;
  scopeId: string;
  userId: string;
  // null means unlimited.
  limit: number | null;
  // The student's message row, ready to insert (must have sender: 'user').
  row: Record<string, unknown>;
}

export interface ReserveResult {
  allowed: boolean;
  // Present when the message was saved; pass it to releaseMessageSlot() if the
  // AI call later fails.
  messageId: string | null;
  used: number;
}

async function countUserMessages(
  table: MessageTable,
  scopeColumn: ScopeColumn,
  scopeId: string,
  userId: string
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(scopeColumn, scopeId)
    .eq('user_id', userId)
    .eq('sender', 'user');

  if (error) {
    console.error(`[quota] Could not count ${table}:`, error);
    return 0;
  }
  return count ?? 0;
}

export async function reserveMessageSlot(options: ReserveOptions): Promise<ReserveResult> {
  const { table, scopeColumn, scopeId, userId, limit, row } = options;

  // Fast path: already at the limit, so do not even save the message.
  if (limit !== null) {
    const used = await countUserMessages(table, scopeColumn, scopeId, userId);
    if (used >= limit) return { allowed: false, messageId: null, used };
  }

  const { data: saved, error: insertError } = await supabaseAdmin
    .from(table)
    .insert(row)
    .select('id, created_at')
    .single();

  if (insertError || !saved) {
    // Saving the message is best-effort (the chat itself still works), but it
    // means there is nothing to rank, so the limit cannot be enforced for this
    // one request.
    console.error(`[quota] Could not save message in ${table}:`, insertError);
    return { allowed: true, messageId: null, used: 0 };
  }

  if (limit === null) return { allowed: true, messageId: saved.id, used: 0 };

  // Rank this message among the student's messages in this conversation.
  const [{ count: earlier }, { count: sameTimeEarlierId }] = await Promise.all([
    supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(scopeColumn, scopeId)
      .eq('user_id', userId)
      .eq('sender', 'user')
      .lt('created_at', saved.created_at),
    supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(scopeColumn, scopeId)
      .eq('user_id', userId)
      .eq('sender', 'user')
      .eq('created_at', saved.created_at)
      .lt('id', saved.id),
  ]);

  const rank = (earlier ?? 0) + (sameTimeEarlierId ?? 0) + 1;

  if (rank > limit) {
    await releaseMessageSlot(table, saved.id);
    return { allowed: false, messageId: null, used: limit };
  }

  return { allowed: true, messageId: saved.id, used: rank };
}

export async function releaseMessageSlot(table: MessageTable, messageId: string): Promise<void> {
  const { error } = await supabaseAdmin.from(table).delete().eq('id', messageId);
  if (error) console.error(`[quota] Could not release message slot in ${table}:`, error);
}
