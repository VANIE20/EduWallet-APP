// ==================== OTP-BASED AUTHENTICATION ====================
// Add these functions to your lib/storage.ts file

import { supabase } from './supabase';
import { getLoggedInUser, setLoggedInUser } from './storage';
import type { LoggedInUser, UserRole } from './storage';

/**
 * Sign up with OTP - sends verification code to email
 * This replaces the password-based signUp function
 */
export async function signUpWithOTP(
  email: string,
  displayName: string,
  role: 'guardian' | 'student'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use Supabase's magic link / OTP feature
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        data: {
          display_name: displayName,
          role: role,
        },
        shouldCreateUser: true, // Create user if doesn't exist
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Verify OTP code and complete signup/signin
 */
export async function verifyOTP(
  email: string,
  token: string
): Promise<{ user: LoggedInUser | null; success: boolean; error?: string }> {
  try {
    // Verify the OTP token
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email',
    });

    if (authError) {
      return { user: null, success: false, error: authError.message };
    }

    if (!authData.user) {
      return { user: null, success: false, error: 'Verification failed' };
    }

    // Check if user profile exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If profile doesn't exist, create it
    if (!existingProfile) {
      const displayName = authData.user.user_metadata?.display_name || 'User';
      const role = authData.user.user_metadata?.role || 'student';

      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email,
          display_name: displayName,
          role: role,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway - profile might exist from auth trigger
      }

      // Create wallet
      await supabase.from('wallets').insert({
        user_id: authData.user.id,
        balance: 0,
      });
    }

    // Fetch the user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      // If profile still doesn't exist, use auth metadata
      const user: LoggedInUser = {
        id: authData.user.id,
        email: authData.user.email || email,
        displayName: authData.user.user_metadata?.display_name || 'User',
        role: (authData.user.user_metadata?.role || 'student') as UserRole,
        linkedUserIds: [],
        isLinked: false,
      };
      await setLoggedInUser(user);
      return { user, success: true };
    }

    // Get linked accounts
    const { data: links } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(`guardian_id.eq.${profile.id},student_id.eq.${profile.id}`);

    const linkedUserIds: string[] = [];
    links?.forEach((link: { guardian_id: string; student_id: string }) => {
      if (link.guardian_id === profile.id && link.student_id) {
        linkedUserIds.push(link.student_id);
      }
      if (link.student_id === profile.id && link.guardian_id) {
        linkedUserIds.push(link.guardian_id);
      }
    });

    const user: LoggedInUser = {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role as UserRole,
      linkedUserIds: linkedUserIds,
      isLinked: linkedUserIds.length > 0,
    };

    await setLoggedInUser(user);
    return { user, success: true };
  } catch (error: any) {
    return { user: null, success: false, error: error.message };
  }
}

/**
 * Sign in with OTP - sends code to email for existing users
 */
export async function signInWithOTP(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // Don't create new user for signin
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
