export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ProfileType = 'INDIVIDUAL' | 'COUPLE' | 'GROUP';
export type AdminRole = 'USER' | 'MODERATOR' | 'DIRECTORY_ADMIN' | 'SUPERADMIN';
export type PostType = 'EXPERIENCE' | 'QUESTION' | 'CONFESSION';
export type PostStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type CommentStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED';
export type ReportReason = 'MINOR' | 'NON_CONSENSUAL' | 'PERSONAL_DATA' | 'THREAT' | 'EXTORTION' | 'HARASSMENT' | 'SPAM' | 'OTHER';
export type ReportStatus = 'OPEN' | 'IN_REVIEW' | 'WAITING_USER' | 'ESCALATED' | 'RESOLVED';
export type ModerationPriority = 'LOW' | 'REVIEW' | 'CRITICAL';
export type UserSanctionAction = 'WARNING' | 'TEMPORARY_RESTRICTION' | 'SUSPEND' | 'PERMANENT_SUSPENSION';
export type ModerationActionType = 'APPROVE' | 'REQUEST_CHANGES' | 'HIDE' | 'DELETE' | 'WARN' | 'RESTRICT_POSTS' | 'RESTRICT_MESSAGES' | 'SUSPEND' | 'BAN';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          alias: string
          alias_last_changed_at: string
          profile_type: ProfileType
          description: string | null
          province: string | null
          city: string | null
          tags: string[]
          avatar_url: string | null
          email_verified: boolean
          profile_searchable: boolean
          experiences_count: number
          comments_count: number
          reactions_received: number
          badges: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          alias: string
          alias_last_changed_at?: string
          profile_type?: ProfileType
          description?: string | null
          province?: string | null
          city?: string | null
          tags?: string[]
          avatar_url?: string | null
          email_verified?: boolean
          profile_searchable?: boolean
          experiences_count?: number
          comments_count?: number
          reactions_received?: number
          badges?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          alias?: string
          alias_last_changed_at?: string
          profile_type?: ProfileType
          description?: string | null
          province?: string | null
          city?: string | null
          tags?: string[]
          avatar_url?: string | null
          email_verified?: boolean
          profile_searchable?: boolean
          experiences_count?: number
          comments_count?: number
          reactions_received?: number
          badges?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_roles: {
        Row: {
          user_id: string
          role: AdminRole
          assigned_at: string
          assigned_by: string | null
        }
        Insert: {
          user_id: string
          role?: AdminRole
          assigned_at?: string
          assigned_by?: string | null
        }
        Update: {
          user_id?: string
          role?: AdminRole
          assigned_at?: string
          assigned_by?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          id: string
          author_id: string
          type: PostType
          category_id: string
          title: string
          slug: string
          content: string
          province: string | null
          city: string | null
          status: PostStatus
          views_count: number
          reactions_count: number
          comments_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          type: PostType
          category_id: string
          title: string
          slug: string
          content: string
          province?: string | null
          city?: string | null
          status?: PostStatus
          views_count?: number
          reactions_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          type?: PostType
          category_id?: string
          title?: string
          slug?: string
          content?: string
          province?: string | null
          city?: string | null
          status?: PostStatus
          views_count?: number
          reactions_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          parent_id: string | null
          content: string
          status: CommentStatus
          depth: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          parent_id?: string | null
          content: string
          status?: CommentStatus
          depth?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          parent_id?: string | null
          content?: string
          status?: CommentStatus
          depth?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          id: string
          user_id: string
          post_id: string | null
          comment_id: string | null
          type: 'ME_INTERESA'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          post_id?: string | null
          comment_id?: string | null
          type?: 'ME_INTERESA'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          post_id?: string | null
          comment_id?: string | null
          type?: 'ME_INTERESA'
          created_at?: string
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          post_id?: string
          created_at?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
        Relationships: []
      }
      moderation_ai_results: {
        Row: {
          id: string
          case_id: string | null
          entity_type: 'POST' | 'COMMENT' | null
          entity_id: string | null
          content_version_id: string | null
          model: string
          risk_level: ModerationPriority
          flags: string[]
          confidence: number | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id?: string | null
          entity_type?: 'POST' | 'COMMENT' | null
          entity_id?: string | null
          content_version_id?: string | null
          model: string
          risk_level: ModerationPriority
          flags?: string[]
          confidence?: number | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string | null
          entity_type?: 'POST' | 'COMMENT' | null
          entity_id?: string | null
          content_version_id?: string | null
          model?: string
          risk_level?: ModerationPriority
          flags?: string[]
          confidence?: number | null
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string
          old_data: Json | null
          new_data: Json | null
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id: string
          old_data?: Json | null
          new_data?: Json | null
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          old_data?: Json | null
          new_data?: Json | null
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      moderation_cases: {
        Row: {
          id: string
          report_id: string | null
          target_type: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | null
          target_id: string | null
          assigned_moderator_id: string | null
          status: ReportStatus
          priority: ModerationPriority
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          report_id?: string | null
          target_type?: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | null
          target_id?: string | null
          assigned_moderator_id?: string | null
          status?: ReportStatus
          priority?: ModerationPriority
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          report_id?: string | null
          target_type?: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE' | null
          target_id?: string | null
          assigned_moderator_id?: string | null
          status?: ReportStatus
          priority?: ModerationPriority
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      moderation_actions: {
        Row: {
          id: string
          case_id: string | null
          moderator_id: string
          action_type: ModerationActionType
          target_user_id: string | null
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          case_id?: string | null
          moderator_id: string
          action_type: ModerationActionType
          target_user_id?: string | null
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string | null
          moderator_id?: string
          action_type?: ModerationActionType
          target_user_id?: string | null
          reason?: string
          created_at?: string
        }
        Relationships: []
      }
      content_versions: {
        Row: {
          id: string
          entity_type: 'POST' | 'COMMENT'
          entity_id: string
          version_number: number
          title: string | null
          content: string
          edited_by: string
          created_at: string
        }
        Insert: {
          id?: string
          entity_type: 'POST' | 'COMMENT'
          entity_id: string
          version_number: number
          title?: string | null
          content: string
          edited_by: string
          created_at?: string
        }
        Update: {
          id?: string
          entity_type?: 'POST' | 'COMMENT'
          entity_id?: string
          version_number?: number
          title?: string | null
          content?: string
          edited_by?: string
          created_at?: string
        }
        Relationships: []
      }
      user_moderation_actions: {
        Row: {
          id: string
          user_id: string
          action: UserSanctionAction
          reason: string
          expires_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: UserSanctionAction
          reason: string
          expires_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: UserSanctionAction
          reason?: string
          expires_at?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
          status: 'ACTIVE' | 'INACTIVE'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: 'ACTIVE' | 'INACTIVE'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: 'ACTIVE' | 'INACTIVE'
          created_at?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          post_id: string
          tag_id: string
        }
        Insert: {
          post_id: string
          tag_id: string
        }
        Update: {
          post_id?: string
          tag_id?: string
        }
        Relationships: []
      }
      post_follows: {
        Row: {
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          post_id?: string
          created_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          target_type: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE'
          target_id: string
          reason: ReportReason
          details: string | null
          status: ReportStatus
          case_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          target_type: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE'
          target_id: string
          reason: ReportReason
          details?: string | null
          status?: ReportStatus
          case_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          target_type?: 'POST' | 'COMMENT' | 'PROFILE' | 'MESSAGE'
          target_id?: string
          reason?: ReportReason
          details?: string | null
          status?: ReportStatus
          case_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          message_policy: 'EVERYONE' | 'NOBODY'
          updated_at: string
        }
        Insert: {
          user_id: string
          message_policy?: 'EVERYONE' | 'NOBODY'
          updated_at?: string
        }
        Update: {
          user_id?: string
          message_policy?: 'EVERYONE' | 'NOBODY'
          updated_at?: string
        }
        Relationships: []
      }
      message_requests: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          initial_message: string
          status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED'
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          initial_message: string
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED'
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          initial_message?: string
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'BLOCKED'
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          request_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "message_requests"
            referencedColumns: ["id"]
          }
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          conversation_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          conversation_id?: string
          user_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          deleted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content: string
          deleted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          deleted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          actor_id: string | null
          type: 'MESSAGE' | 'MESSAGE_REQUEST' | 'MESSAGE_REQUEST_ACCEPTED' | 'MESSAGE_REQUEST_REJECTED'
          entity_type: 'CONVERSATION' | 'MESSAGE_REQUEST'
          entity_id: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          actor_id?: string | null
          type: 'MESSAGE' | 'MESSAGE_REQUEST' | 'MESSAGE_REQUEST_ACCEPTED' | 'MESSAGE_REQUEST_REJECTED'
          entity_type: 'CONVERSATION' | 'MESSAGE_REQUEST'
          entity_id: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          actor_id?: string | null
          type?: 'MESSAGE' | 'MESSAGE_REQUEST' | 'MESSAGE_REQUEST_ACCEPTED' | 'MESSAGE_REQUEST_REJECTED'
          entity_type?: 'CONVERSATION' | 'MESSAGE_REQUEST'
          entity_id?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mark_notification_read: {
        Args: {
          target_notification_id: string
        }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_unread_notifications_count: {
        Args: Record<string, never>
        Returns: number
      }
      create_message_request: {
        Args: {
          target_receiver_id: string
          initial_msg: string
        }
        Returns: string
      }
      accept_message_request: {
        Args: {
          target_request_id: string
        }
        Returns: string
      }
      reject_message_request: {
        Args: {
          target_request_id: string
        }
        Returns: boolean
      }
      block_message_request: {
        Args: {
          target_request_id: string
        }
        Returns: boolean
      }
      soft_delete_message: {
        Args: {
          target_message_id: string
        }
        Returns: boolean
      }
      is_blocked_between: {
        Args: {
          user_a: string
          user_b: string
        }
        Returns: boolean
      }
      is_conversation_active_for_user: {
        Args: {
          target_conversation_id: string
        }
        Returns: boolean
      }
      can_receive_message_request: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      increment_post_views: {
        Args: {
          target_post_id: string
        }
        Returns: void
      }
      get_user_role: {
        Args: {
          target_user_id: string
        }
        Returns: string
      }
      is_admin: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      is_moderator: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      is_superadmin: {
        Args: {
          target_user_id: string
        }
        Returns: boolean
      }
      can_send_message: {
        Args: {
          sender_uuid: string
          recipient_uuid: string
          req_id: string
        }
        Returns: boolean
      }
      soft_delete_post: {
        Args: {
          target_post_id: string
        }
        Returns: void
      }
      moderate_post_status: {
        Args: {
          target_post_id: string
          new_status: string
        }
        Returns: void
      }
      submit_report_with_case: {
        Args: {
          target_type_param: string
          target_id_param: string
          reason_param: string
          details_param?: string | null
        }
        Returns: string
      }
      execute_moderation_action: {
        Args: {
          case_id_param: string
          action_type_param: string
          reason_param: string
          notes_param?: string | null
          new_case_status_param?: string
        }
        Returns: string
      }
      apply_user_sanction: {
        Args: {
          target_user_id_param: string
          action_param: string
          reason_param: string
          expires_at_param?: string | null
          case_id_param?: string | null
        }
        Returns: string
      }
      assign_moderation_case: {
        Args: {
          case_id_param: string
        }
        Returns: string
      }
      record_ai_moderation_result: {
        Args: {
          entity_type_param: string
          entity_id_param: string
          content_version_id_param?: string | null
          model_param: string
          risk_level_param: string
          flags_param: string[]
          confidence_param: number
          reason_param: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
