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
          case_id: string
          model: string
          risk_level: ModerationPriority
          flags: string[]
          confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          model: string
          risk_level: ModerationPriority
          flags?: string[]
          confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          model?: string
          risk_level?: ModerationPriority
          flags?: string[]
          confidence?: number | null
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
