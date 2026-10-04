import { createClient } from '@/lib/supabase/server';
import type {
  ModerationPriority,
  ReportStatus,
  UserSanctionAction,
  ModerationActionType,
  ReportReason,
} from '@/types/database';

export interface ModerationCasesFilterOptions {
  status?: ReportStatus | 'ALL';
  priority?: ModerationPriority | 'ALL';
  targetType?: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | 'ALL';
  page?: number;
  limit?: number;
}

export interface ModerationCaseListItem {
  id: string;
  report_id: string | null;
  target_type: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | null;
  target_id: string | null;
  assigned_moderator_id: string | null;
  assigned_moderator_alias?: string | null;
  status: ReportStatus;
  priority: ModerationPriority;
  notes: string | null;
  created_at: string;
  updated_at: string;
  reports_count: number;
  first_report?: {
    reason: ReportReason;
    details: string | null;
    reporter_alias?: string;
  };
}

export async function getModerationCases(options: ModerationCasesFilterOptions = {}) {
  const supabase = await createClient();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase.from('moderation_cases').select(
    `
      id,
      report_id,
      target_type,
      target_id,
      assigned_moderator_id,
      status,
      priority,
      notes,
      created_at,
      updated_at,
      assigned_moderator:profiles!moderation_cases_assigned_moderator_id_fkey(alias),
      reports(
        id,
        reason,
        details,
        reporter:profiles!reports_reporter_id_fkey(alias)
      )
    `,
    { count: 'exact' }
  );

  if (options.status && options.status !== 'ALL') {
    query = query.eq('status', options.status);
  }

  if (options.priority && options.priority !== 'ALL') {
    query = query.eq('priority', options.priority);
  }

  if (options.targetType && options.targetType !== 'ALL') {
    query = query.eq('target_type', options.targetType);
  }

  // Fetch all matching data to sort accurately by priority weight
  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching moderation cases:', error);
    return { cases: [], total: 0 };
  }

  const priorityWeight: Record<ModerationPriority, number> = {
    CRITICAL: 1,
    REVIEW: 2,
    LOW: 3,
  };

  const formattedCases: ModerationCaseListItem[] = (data || []).map((c: any) => {
    const reports = c.reports || [];
    const firstReport = reports[0];
    return {
      id: c.id,
      report_id: c.report_id,
      target_type: c.target_type,
      target_id: c.target_id,
      assigned_moderator_id: c.assigned_moderator_id,
      assigned_moderator_alias: c.assigned_moderator?.alias || null,
      status: c.status,
      priority: c.priority,
      notes: c.notes,
      created_at: c.created_at,
      updated_at: c.updated_at,
      reports_count: reports.length,
      first_report: firstReport
        ? {
            reason: firstReport.reason,
            details: firstReport.details,
            reporter_alias: firstReport.reporter?.alias,
          }
        : undefined,
    };
  });

  // Sort by priority weight (CRITICAL -> REVIEW -> LOW), then created_at ASC
  formattedCases.sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 4;
    const weightB = priorityWeight[b.priority] || 4;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const paginatedCases = formattedCases.slice(offset, offset + limit);

  return {
    cases: paginatedCases,
    total: count ?? formattedCases.length,
  };
}

export async function getModerationCaseDetail(caseId: string) {
  const supabase = await createClient();

  const { data: caseData, error: caseError } = await supabase
    .from('moderation_cases')
    .select(
      `
      id,
      report_id,
      target_type,
      target_id,
      assigned_moderator_id,
      status,
      priority,
      notes,
      created_at,
      updated_at,
      assigned_moderator:profiles!moderation_cases_assigned_moderator_id_fkey(id, alias, avatar_url)
    `
    )
    .eq('id', caseId)
    .maybeSingle();

  if (caseError || !caseData) {
    console.error('Error fetching moderation case detail:', caseError);
    return null;
  }

  // Fetch all reports linked to this case or target
  let reportsQuery = supabase
    .from('reports')
    .select(
      `
      id,
      reporter_id,
      target_type,
      target_id,
      reason,
      details,
      status,
      created_at,
      reporter:profiles!reports_reporter_id_fkey(id, alias, avatar_url)
    `
    )
    .eq('case_id', caseId);

  const { data: linkedReports } = await reportsQuery;

  // Fallback: search reports by target if none linked by case_id
  let reports = linkedReports || [];
  if (reports.length === 0 && caseData.target_type && caseData.target_id) {
    const { data: targetReports } = await supabase
      .from('reports')
      .select(
        `
        id,
        reporter_id,
        target_type,
        target_id,
        reason,
        details,
        status,
        created_at,
        reporter:profiles!reports_reporter_id_fkey(id, alias, avatar_url)
      `
      )
      .eq('target_type', caseData.target_type)
      .eq('target_id', caseData.target_id);

    reports = targetReports || [];
  }

  // Fetch Target Entity Info
  let targetEntity: any = null;
  let targetAuthor: any = null;

  if (caseData.target_type === 'POST' && caseData.target_id) {
    const { data: post } = await supabase
      .from('posts')
      .select(
        `
        id,
        title,
        content,
        status,
        created_at,
        author_id,
        author:profiles!posts_author_id_fkey(id, alias, avatar_url, created_at)
      `
      )
      .eq('id', caseData.target_id)
      .maybeSingle();

    if (post) {
      targetEntity = post;
      targetAuthor = post.author;
    }
  } else if (caseData.target_type === 'COMMENT' && caseData.target_id) {
    const { data: comment } = await supabase
      .from('comments')
      .select(
        `
        id,
        content,
        status,
        created_at,
        post_id,
        author_id,
        author:profiles!comments_author_id_fkey(id, alias, avatar_url, created_at)
      `
      )
      .eq('id', caseData.target_id)
      .maybeSingle();

    if (comment) {
      targetEntity = comment;
      targetAuthor = comment.author;
    }
  } else if (caseData.target_type === 'PROFILE' && caseData.target_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, alias, avatar_url, description, profile_type, created_at')
      .eq('id', caseData.target_id)
      .maybeSingle();

    if (profile) {
      targetEntity = profile;
      targetAuthor = profile;
    }
  } else if (caseData.target_type === 'MESSAGE' && caseData.target_id) {
    const { data: msg } = await supabase
      .from('messages')
      .select(
        `
        id,
        content,
        created_at,
        sender_id,
        sender:profiles!messages_sender_id_fkey(id, alias, avatar_url, created_at)
      `
      )
      .eq('id', caseData.target_id)
      .maybeSingle();

    if (msg) {
      targetEntity = msg;
      targetAuthor = msg.sender;
    }
  }

  // Content version history
  let contentVersions: any[] = [];
  if (
    (caseData.target_type === 'POST' || caseData.target_type === 'COMMENT') &&
    caseData.target_id
  ) {
    const { data: versions } = await supabase
      .from('content_versions')
      .select(
        `
        id,
        entity_type,
        entity_id,
        version_number,
        title,
        content,
        edited_by,
        created_at,
        editor:profiles!content_versions_edited_by_fkey(alias)
      `
      )
      .eq('entity_type', caseData.target_type)
      .eq('entity_id', caseData.target_id)
      .order('version_number', { ascending: false });

    contentVersions = versions || [];
  }

  // Target Author Context (sanction history & total report count)
  let userSanctions: any[] = [];
  let authorTotalReportsCount = 0;

  if (targetAuthor?.id) {
    const { data: sanctions } = await supabase
      .from('user_moderation_actions')
      .select(
        `
        id,
        action,
        reason,
        expires_at,
        created_at,
        creator:profiles!user_moderation_actions_created_by_fkey(alias)
      `
      )
      .eq('user_id', targetAuthor.id)
      .order('created_at', { ascending: false });

    userSanctions = sanctions || [];

    const { count: reportCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', targetAuthor.id);

    authorTotalReportsCount = reportCount || 0;
  }

  // Case moderation actions history
  const { data: actionsData } = await supabase
    .from('moderation_actions')
    .select(
      `
      id,
      case_id,
      moderator_id,
      action_type,
      target_user_id,
      reason,
      created_at,
      moderator:profiles!moderation_actions_moderator_id_fkey(alias)
    `
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  // Audit logs for entity
  let auditLogs: any[] = [];
  if (caseData.target_id) {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('id, actor_id, action, entity_type, entity_id, old_data, new_data, reason, created_at')
      .eq('entity_id', caseData.target_id)
      .order('created_at', { ascending: false });

    auditLogs = logs || [];
  }

  return {
    caseInfo: caseData,
    reports,
    targetEntity,
    targetAuthor,
    contentVersions,
    userSanctions,
    authorTotalReportsCount,
    moderationActions: actionsData || [],
    auditLogs,
  };
}

export async function assignModerationCase(caseId: string, moderatorId: string) {
  const supabase = await createClient();

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
    throw new Error(`Failed to assign case: ${error.message}`);
  }

  return data;
}

export async function executeModerationAction(params: {
  caseId: string;
  moderatorId: string;
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
  newCaseStatus?: ReportStatus;
}) {
  const supabase = await createClient();

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
    throw new Error(`Failed to record moderation action: ${actionErr.message}`);
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

export async function applyUserSanction(params: {
  userId: string;
  createdBy: string;
  action: UserSanctionAction;
  reason: string;
  expiresAt?: string | null;
  caseId?: string;
}) {
  const supabase = await createClient();

  // 1. Create user_moderation_action row
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
    throw new Error(`Failed to apply user sanction: ${sanctionErr.message}`);
  }

  // 2. Map sanction to moderation_action if linked to case
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

  // 3. Register audit log
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

export async function saveContentVersion(params: {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  title?: string | null;
  content: string;
  editedBy: string;
}) {
  const supabase = await createClient();

  // Fetch current max version_number
  const { data: latest } = await supabase
    .from('content_versions')
    .select('version_number')
    .eq('entity_type', params.entityType)
    .eq('entity_id', params.entityId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version_number || 0) + 1;

  const { data, error } = await supabase
    .from('content_versions')
    .insert({
      entity_type: params.entityType,
      entity_id: params.entityId,
      version_number: nextVersion,
      title: params.title || null,
      content: params.content,
      edited_by: params.editedBy,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save content version: ${error.message}`);
  }

  return data;
}
