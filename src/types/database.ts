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
          experiences_count?: number
          comments_count?: number
          reactions_received?: number
          badges?: string[]
          created_at?: string
          updated_at?: string
        }
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
      }
    }
  }
}
