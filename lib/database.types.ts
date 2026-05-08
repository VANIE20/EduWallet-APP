export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          username: string
          display_name: string
          role: 'guardian' | 'student'
          linked_user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          username: string
          display_name: string
          role: 'guardian' | 'student'
          linked_user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          username?: string
          display_name?: string
          role?: 'guardian' | 'student'
          linked_user_id?: string | null
        }
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          created_at: string
          type: 'deposit' | 'allowance' | 'expense'
          amount: number
          description: string
          category: string | null
          from_user_id: string | null
          to_user_id: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          type: 'deposit' | 'allowance' | 'expense'
          amount: number
          description: string
          category?: string | null
          from_user_id?: string | null
          to_user_id?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          type?: 'deposit' | 'allowance' | 'expense'
          amount?: number
          description?: string
          category?: string | null
          from_user_id?: string | null
          to_user_id?: string | null
        }
      }
      allowance_configs: {
        Row: {
          id: string
          guardian_id: string
          student_id: string
          amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          day_of_week: number
          is_active: boolean
          last_allowance_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          guardian_id: string
          student_id: string
          amount: number
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          day_of_week?: number
          is_active?: boolean
          last_allowance_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          guardian_id?: string
          student_id?: string
          amount?: number
          frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly'
          day_of_week?: number
          is_active?: boolean
          last_allowance_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      spending_limits: {
        Row: {
          id: string
          student_id: string
          daily_limit: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          daily_limit: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          daily_limit?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          student_id: string
          name: string
          target_amount: number
          current_amount: number
          icon_name: string
          created_at: string
          updated_at: string
          is_locked: boolean
          locked_by: string | null
          deadline: string | null
        }
        Insert: {
          id?: string
          student_id: string
          name: string
          target_amount: number
          current_amount?: number
          icon_name: string
          created_at?: string
          updated_at?: string
          is_locked?: boolean
          locked_by?: string | null
          deadline?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          icon_name?: string
          created_at?: string
          updated_at?: string
          is_locked?: boolean
          locked_by?: string | null
          deadline?: string | null
        }
      }
    }
  }
}