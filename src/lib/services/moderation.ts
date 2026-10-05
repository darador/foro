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
  riskLevel?: 'CRITICAL' | 'REVIEW' | 'LOW' | 'ALL';
  targetType?: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | 'ALL';
  assignedTo?: string | 'ME' | 'UNASSIGNED' | 'ALL';
  currentUserId?: string;
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
  latest_ai_result?: {
    model: string;
    risk_level: 'LOW' | 'REVIEW' | 'CRITICAL';
    flags: string[];
    confidence: number | null;
    reason: string | null;
    created_at: string;
  } | null;
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
      ),
      ai_results:moderation_ai_results(
        id,
        model,
        risk_level,
        flags,
        confidence,
        reason,
        created_at
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

  if (options.assignedTo && options.assignedTo !== 'ALL') {
    if (options.assignedTo === 'UNASSIGNED') {
      query = query.is('assigned_moderator_id', null);
    } else if (options.assignedTo === 'ME') {
      if (options.currentUserId) {
        query = query.eq('assigned_moderator_id', options.currentUserId);
      }
    } else {
      query = query.eq('assigned_moderator_id', options.assignedTo);
    }
  }

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
    const aiResults = c.ai_results || [];
    const sortedAi = [...aiResults].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latestAi = sortedAi[0] || null;

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
      latest_ai_result: latestAi
        ? {
            model: latestAi.model,
            risk_level: latestAi.risk_level,
            flags: latestAi.flags || [],
            confidence: latestAi.confidence,
            reason: latestAi.reason,
            created_at: latestAi.created_at,
          }
        : null,
    };
  });

  // Filter by riskLevel if provided
  let filteredList = formattedCases;
  if (options.riskLevel && options.riskLevel !== 'ALL') {
    filteredList = filteredList.filter(
      (c) => c.priority === options.riskLevel || c.latest_ai_result?.risk_level === options.riskLevel
    );
  }

  filteredList.sort((a, b) => {
    const weightA = priorityWeight[a.priority] || 4;
    const weightB = priorityWeight[b.priority] || 4;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const paginatedCases = filteredList.slice(offset, offset + limit);

  return {
    cases: paginatedCases,
    total: count ?? filteredList.length,
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

  // Target Author Context: sanctions history & reports RECEIVED on author's content
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

    // Calculate reports received against author's profile, posts, comments, or messages
    const { data: userPosts } = await supabase.from('posts').select('id').eq('author_id', targetAuthor.id);
    const postIds = (userPosts || []).map((p) => p.id);

    const { data: userComments } = await supabase.from('comments').select('id').eq('author_id', targetAuthor.id);
    const commentIds = (userComments || []).map((c) => c.id);

    const { data: userMsgs } = await supabase.from('messages').select('id').eq('sender_id', targetAuthor.id);
    const msgIds = (userMsgs || []).map((m) => m.id);

    let totalReceivedReports = 0;

    const { count: profileReportsCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', 'PROFILE')
      .eq('target_id', targetAuthor.id);
    totalReceivedReports += profileReportsCount || 0;

    if (postIds.length > 0) {
      const { count: postReportsCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', 'POST')
        .in('target_id', postIds);
      totalReceivedReports += postReportsCount || 0;
    }

    if (commentIds.length > 0) {
      const { count: commentReportsCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', 'COMMENT')
        .in('target_id', commentIds);
      totalReceivedReports += commentReportsCount || 0;
    }

    if (msgIds.length > 0) {
      const { count: msgReportsCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', 'MESSAGE')
        .in('target_id', msgIds);
      totalReceivedReports += msgReportsCount || 0;
    }

    authorTotalReportsCount = totalReceivedReports;
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

  // AI Moderation Results
  let aiResults: any[] = [];
  if (caseData.target_id) {
    const { data: aiData } = await supabase
      .from('moderation_ai_results')
      .select('id, case_id, entity_type, entity_id, content_version_id, model, risk_level, flags, confidence, reason, created_at')
      .or(`case_id.eq.${caseId},entity_id.eq.${caseData.target_id}`)
      .order('created_at', { ascending: false });

    aiResults = aiData || [];
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
    aiResults,
  };
}

export async function assignModerationCase(caseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('assign_moderation_case', {
    case_id_param: caseId,
  });

  if (error) {
    throw new Error(`Failed to assign case: ${error.message}`);
  }

  return data;
}

export async function executeModerationAction(params: {
  caseId: string;
  actionType: ModerationActionType;
  reason: string;
  notes?: string;
  newCaseStatus?: ReportStatus;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('execute_moderation_action', {
    case_id_param: params.caseId,
    action_type_param: params.actionType,
    reason_param: params.reason,
    notes_param: params.notes || null,
    new_case_status_param: params.newCaseStatus || 'RESOLVED',
  });

  if (error) {
    throw new Error(`Failed to execute moderation action: ${error.message}`);
  }

  return data;
}

export async function applyUserSanction(params: {
  userId: string;
  action: UserSanctionAction;
  reason: string;
  expiresAt?: string | null;
  caseId?: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('apply_user_sanction', {
    target_user_id_param: params.userId,
    action_param: params.action,
    reason_param: params.reason,
    expires_at_param: params.expiresAt || null,
    case_id_param: params.caseId || null,
  });

  if (error) {
    throw new Error(`Failed to apply user sanction: ${error.message}`);
  }

  return data;
}

export async function saveContentVersion(params: {
  entityType: 'POST' | 'COMMENT';
  entityId: string;
  title?: string | null;
  content: string;
  editedBy: string;
}) {
  const supabase = await createClient();

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
