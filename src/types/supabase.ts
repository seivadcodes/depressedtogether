export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calls: {
        Row: {
          acceptor_id: string | null
          acceptor_name: string | null
          callee_id: string | null
          caller_id: string
          caller_name: string
          created_at: string | null
          id: string
          room_name: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          acceptor_id?: string | null
          acceptor_name?: string | null
          callee_id?: string | null
          caller_id: string
          caller_name: string
          created_at?: string | null
          id?: string
          room_name?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          acceptor_id?: string | null
          acceptor_name?: string | null
          callee_id?: string | null
          caller_id?: string
          caller_name?: string
          created_at?: string | null
          id?: string
          room_name?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          created_at: string | null
          description: string | null
          grief_type: string | null
          id: string
          member_count: number | null
          name: string
          online_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          grief_type?: string | null
          id: string
          member_count?: number | null
          name: string
          online_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          grief_type?: string | null
          id?: string
          member_count?: number | null
          name?: string
          online_count?: number | null
        }
        Relationships: []
      }
      community_likes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          is_admin: boolean | null
          joined_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          is_admin?: boolean | null
          joined_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          is_admin?: boolean | null
          joined_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments_with_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          comments_count: number | null
          community_id: string
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          media_url: string | null
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          community_id: string
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          media_url?: string | null
          user_id: string
        }
        Update: {
          comments_count?: number | null
          community_id?: string
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_attendees: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_attendee_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_chat_messages: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          message: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          message: string
          sender_id: string
          sender_name: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          message?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          event_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          user_id: string
          user_name: string
        }
        Insert: {
          event_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id: string
          user_name: string
        }
        Update: {
          event_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      event_registrations: {
        Row: {
          event_id: string
          registered_at: string | null
          user_id: string
        }
        Insert: {
          event_id: string
          registered_at?: string | null
          user_id: string
        }
        Update: {
          event_id?: string
          registered_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_attendee_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          description: string | null
          duration: number
          grief_types: string[] | null
          host_id: string | null
          host_name: string | null
          id: string
          image_url: string | null
          is_recurring: boolean | null
          max_attendees: number | null
          start_time: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration: number
          grief_types?: string[] | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          image_url?: string | null
          is_recurring?: boolean | null
          max_attendees?: number | null
          start_time: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: number
          grief_types?: string[] | null
          host_id?: string | null
          host_name?: string | null
          id?: string
          image_url?: string | null
          is_recurring?: boolean | null
          max_attendees?: number | null
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string | null
          current_players: number | null
          description: string | null
          id: string
          max_players: number | null
          name: string
        }
        Insert: {
          created_at?: string | null
          current_players?: number | null
          description?: string | null
          id: string
          max_players?: number | null
          name: string
        }
        Update: {
          created_at?: string | null
          current_players?: number | null
          description?: string | null
          id?: string
          max_players?: number | null
          name?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          accepted_by: string | null
          created_at: string | null
          id: string
          message: string
          room_name: string | null
          status: string
          user_id: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string | null
          id?: string
          message: string
          room_name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string | null
          id?: string
          message?: string
          room_name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_garden_flowers: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          name: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          name: string
          x: number
          y: number
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          name?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number | null
          community_id: string | null
          created_at: string | null
          grief_types: string[] | null
          id: string
          is_anonymous: boolean | null
          likes_count: number | null
          media_urls: string[] | null
          text: string
          user_id: string | null
        }
        Insert: {
          comments_count?: number | null
          community_id?: string | null
          created_at?: string | null
          grief_types?: string[] | null
          id?: string
          is_anonymous?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          text: string
          user_id?: string | null
        }
        Update: {
          comments_count?: number | null
          community_id?: string | null
          created_at?: string | null
          grief_types?: string[] | null
          id?: string
          is_anonymous?: boolean | null
          likes_count?: number | null
          media_urls?: string[] | null
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accept_from_countries: string[] | null
          accept_from_genders: string[] | null
          accept_from_languages: string[] | null
          accepts_calls: boolean | null
          accepts_video_calls: boolean | null
          avatar_url: string | null
          cover_photo_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          grief_detail: string | null
          grief_types: string[] | null
          id: string
          is_anonymous: boolean | null
          last_online: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          accept_from_countries?: string[] | null
          accept_from_genders?: string[] | null
          accept_from_languages?: string[] | null
          accepts_calls?: boolean | null
          accepts_video_calls?: boolean | null
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          grief_detail?: string | null
          grief_types?: string[] | null
          id: string
          is_anonymous?: boolean | null
          last_online?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          accept_from_countries?: string[] | null
          accept_from_genders?: string[] | null
          accept_from_languages?: string[] | null
          accepts_calls?: boolean | null
          accepts_video_calls?: boolean | null
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          grief_detail?: string | null
          grief_types?: string[] | null
          id?: string
          is_anonymous?: boolean | null
          last_online?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      quick_connect_requests: {
        Row: {
          acceptor_id: string | null
          call_started_at: string | null
          created_at: string
          expires_at: string
          id: string
          room_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          acceptor_id?: string | null
          call_started_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          room_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          acceptor_id?: string | null
          call_started_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          room_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_connect_requests_acceptor_id_fkey"
            columns: ["acceptor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_connect_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_group_requests: {
        Row: {
          call_started_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          room_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          call_started_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          room_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          call_started_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          room_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_with_attendee_count"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          active: boolean | null
          id: string
          joined_at: string | null
          left_at: string | null
          role: string
          room_id: string
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          room_id: string
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          role?: string
          room_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      session_participants: {
        Row: {
          is_host: boolean
          joined_at: string
          left_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          is_host?: boolean
          joined_at?: string
          left_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          is_host?: boolean
          joined_at?: string
          left_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          grief_types: string[]
          host_id: string
          id: string
          mode: string | null
          participant_limit: number
          session_type: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          grief_types: string[]
          host_id: string
          id?: string
          mode?: string | null
          participant_limit?: number
          session_type: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          grief_types?: string[]
          host_id?: string
          id?: string
          mode?: string | null
          participant_limit?: number
          session_type?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          accepted_by: string | null
          created_at: string
          description: string | null
          grief_type: string | null
          id: string
          matched_at: string | null
          request_type: string | null
          requester_id: string | null
          responder_id: string | null
          session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          description?: string | null
          grief_type?: string | null
          id?: string
          matched_at?: string | null
          request_type?: string | null
          requester_id?: string | null
          responder_id?: string | null
          session_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          description?: string | null
          grief_type?: string | null
          id?: string
          matched_at?: string | null
          request_type?: string | null
          requester_id?: string | null
          responder_id?: string | null
          session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          id: string
          last_online: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          id: string
          last_online?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: string
          last_online?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      community_post_comments_with_profiles: {
        Row: {
          avatar_url: string | null
          content: string | null
          created_at: string | null
          id: string | null
          is_anonymous: boolean | null
          parent_comment_id: string | null
          post_id: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "community_post_comments_with_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      events_with_attendee_count: {
        Row: {
          attendee_count: number | null
          created_at: string | null
          description: string | null
          duration: number | null
          grief_types: string[] | null
          host_name: string | null
          id: string | null
          image_url: string | null
          is_recurring: boolean | null
          start_time: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      set_call_started_at: {
        Args: { room_id: string; table_name: string }
        Returns: {
          call_started_at: string
        }[]
      }
    }
    Enums: {
      call_status: "pending" | "active" | "ended" | "cancelled"
      grief_type:
        | "parent"
        | "child"
        | "spouse"
        | "sibling"
        | "friend"
        | "pet"
        | "miscarriage"
        | "caregiver"
        | "suicide"
        | "other"
      session_type: "one_on_one" | "group"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      call_status: ["pending", "active", "ended", "cancelled"],
      grief_type: [
        "parent",
        "child",
        "spouse",
        "sibling",
        "friend",
        "pet",
        "miscarriage",
        "caregiver",
        "suicide",
        "other",
      ],
      session_type: ["one_on_one", "group"],
    },
  },
} as const
