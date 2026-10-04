import { createClient } from '@/lib/supabase/client';
import type {
  ModerationPriority,
  ReportStatus,
  UserSanctionAction,
  ModerationActionType,
} from '@/types/database';

export async function assignModerationCaseClient(caseId: string, moderatorId: string) {
  const supabase = createClient();

  const { data: caseObj } = await supabase
    .from('moderation_cases')
    .select('status')
    .eq('id', caseId)
    .single();

  const newStatus = caseObj?.status === 'OPEN' ? 'IN_REVIEW' : caseObj?.status || 'IN_REVIEW';

  const { data, error } = await supabase
    .from('moderation_cases')
    .update({
      assigned_moderator_id: moderatorId,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', caseId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function executeModerationActionClient(params: {
  caseId: string;
  moderatorId: string;
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
  newCaseStatus?: ReportStatus;
}) {
  const supabase = createClient();

  // 1. Fetch case details
  const { data: caseObj, error: caseErr } = await supabase
    .from('moderation_cases')
    .select('id, target_type, target_id, status')
    .eq('id', params.caseId)
    .single();

  if (caseErr || !caseObj) {
    throw new Error('Case not found');
  }

  // 2. Perform Content Action if target entity is POST or COMMENT
  if (caseObj.target_type === 'POST' && caseObj.target_id) {
    if (params.actionType === 'HIDE') {
      await supabase
        .from('posts')
        .update({ status: 'HIDDEN', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    } else if (params.actionType === 'DELETE') {
      await supabase
        .from('posts')
        .update({ status: 'DELETED', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    } else if (params.actionType === 'APPROVE') {
      await supabase
        .from('posts')
        .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    }
  } else if (caseObj.target_type === 'COMMENT' && caseObj.target_id) {
    if (params.actionType === 'HIDE') {
      await supabase
        .from('comments')
        .update({ status: 'HIDDEN', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    } else if (params.actionType === 'DELETE') {
      await supabase
        .from('comments')
        .update({ status: 'DELETED', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    } else if (params.actionType === 'APPROVE') {
      await supabase
        .from('comments')
        .update({ status: 'PUBLISHED', updated_at: new Date().toISOString() })
        .eq('id', caseObj.target_id);
    }
  }

  // 3. Record moderation action
  const { data: actionData, error: actionErr } = await supabase
    .from('moderation_actions')
    .insert({
      case_id: params.caseId,
      moderator_id: params.moderatorId,
      action_type: params.actionType,
      reason: params.reason,
    })
    .select()
    .single();

  if (actionErr) {
    throw new Error(actionErr.message);
  }

  // 4. Update case status & notes
  const nextStatus = params.newCaseStatus || 'RESOLVED';
  await supabase
    .from('moderation_cases')
    .update({
      status: nextStatus,
      notes: params.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.caseId);

  // 5. Update linked reports status
  await supabase
    .from('reports')
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('case_id', params.caseId);

  // 6. Register audit log
  await supabase.from('audit_logs').insert({
    actor_id: params.moderatorId,
    action: `MODERATION_${params.actionType}`,
    entity_type: caseObj.target_type || 'MODERATION_CASE',
    entity_id: caseObj.target_id || params.caseId,
    reason: params.reason,
    new_data: { action_type: params.actionType, case_id: params.caseId, next_status: nextStatus },
  });

  return actionData;
}

export async function applyUserSanctionClient(params: {
  userId: string;
  createdBy: string;
  action: UserSanctionAction;
  reason: string;
  expiresAt?: string | null;
  caseId?: string;
}) {
  const supabase = createClient();

  const { data: sanctionData, error: sanctionErr } = await supabase
    .from('user_moderation_actions')
    .insert({
      user_id: params.userId,
      action: params.action,
      reason: params.reason,
      expires_at: params.expiresAt || null,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (sanctionErr) {
    throw new Error(sanctionErr.message);
  }

  let mappedActionType: ModerationActionType = 'WARN';
  if (params.action === 'TEMPORARY_RESTRICTION') {
    mappedActionType = 'RESTRICT_POSTS';
  } else if (params.action === 'SUSPEND') {
    mappedActionType = 'SUSPEND';
  } else if (params.action === 'PERMANENT_SUSPENSION') {
    mappedActionType = 'BAN';
  }

  if (params.caseId) {
    await supabase.from('moderation_actions').insert({
      case_id: params.caseId,
      moderator_id: params.createdBy,
      action_type: mappedActionType,
      target_user_id: params.userId,
      reason: params.reason,
    });
  }

  await supabase.from('audit_logs').insert({
    actor_id: params.createdBy,
    action: `USER_SANCTION_${params.action}`,
    entity_type: 'USER',
    entity_id: params.userId,
    reason: params.reason,
    new_data: {
      action: params.action,
      expires_at: params.expiresAt || null,
      case_id: params.caseId || null,
    },
  });

  return sanctionData;
}
