import { createClient } from '@/lib/supabase/client';
import type {
  ReportStatus,
  UserSanctionAction,
  ModerationActionType,
} from '@/types/database';

export async function assignModerationCaseClient(caseId: string) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('assign_moderation_case', {
    case_id_param: caseId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function executeModerationActionClient(params: {
  caseId: string;
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
  newCaseStatus?: ReportStatus;
}) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('execute_moderation_action', {
    case_id_param: params.caseId,
    action_type_param: params.actionType,
    reason_param: params.reason,
    notes_param: params.notes || null,
    new_case_status_param: params.newCaseStatus || 'RESOLVED',
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function applyUserSanctionClient(params: {
  userId: string;
  action: UserSanctionAction;
  reason: string;
  expiresAt?: string | null;
  caseId?: string;
}) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('apply_user_sanction', {
    target_user_id_param: params.userId,
    action_param: params.action,
    reason_param: params.reason,
    expires_at_param: params.expiresAt || null,
    case_id_param: params.caseId || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
