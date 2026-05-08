import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Local storage keys for offline/cache
const KEYS = {
  LOGGED_IN_USER: 'eduwallet_logged_in_user',
  ROLE: 'eduwallet_role',
  CURRENT_USER_ID: 'eduwallet_current_user_id',
};

export interface SpendingLimit {
  dailyLimit: number;
  isActive: boolean;
}

export interface AllowanceConfig {
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek: number;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  referenceId: string;
  type: 'deposit' | 'allowance' | 'expense';
  amount: number;
  description: string;
  category?: string;
  date: string;
  from?: 'guardian' | 'student';
  to?: 'guardian' | 'student';
  toUserId?: string;
  fromUserId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  iconName: string;
  createdAt: string;
  deadline?: string | null;       // ISO date string, optional
  isLocked: boolean;              // guardian can lock — student can't withdraw
  lockedBy?: string | null;       // guardian's displayName who locked it
}

export type UserRole = 'guardian' | 'student' | null;

export interface LoggedInUser {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  linkedUserIds: string[];
  isLinked: boolean;
}

export interface PendingInvite {
  id: string;
  guardianId: string;
  guardianEmail: string;
  guardianName: string;
  studentEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

async function getCurrentUserId(): Promise<string | null> {
  return await AsyncStorage.getItem(KEYS.CURRENT_USER_ID);
}

async function setCurrentUserId(userId: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.setItem(KEYS.CURRENT_USER_ID, userId);
  } else {
    await AsyncStorage.removeItem(KEYS.CURRENT_USER_ID);
  }
}

// ==================== AUTHENTICATION WITH PIN + OTP ====================

export async function signUpWithPinAndOTP(
  email: string,
  pin: string,
  displayName: string,
  role: 'guardian' | 'student'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!/^\d{6}$/.test(pin)) {
      return { success: false, error: 'PIN must be exactly 6 digits' };
    }

    // Build username before signUp so the trigger can read it from user_metadata
    const emailUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const tempUsername = `${emailUsername}_${Date.now().toString(36)}`;

    // Check if email already exists in public.users before attempting signUp
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: pin,
      options: {
        data: {
          display_name: displayName,
          role: role,
          username: tempUsername,
        },
        emailRedirectTo: undefined,
      }
    });

    if (authError) {
      // Supabase returns a vague 500 when email already exists in auth.users
      // (even if public.users has no row for it yet from a previous failed signup)
      if (
        authError.message?.includes('Database error saving new user') ||
        authError.status === 500
      ) {
        // Try sending an OTP to the existing account instead so user can still log in
        const { error: otpRetryError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (!otpRetryError) {
          // OTP sent — the account exists, treat as duplicate
          return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
        }
        return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
      }
      return { success: false, error: authError.message };
    }

    // Supabase sometimes returns a fake user object instead of an error for duplicate emails
    if (!authData.user) {
      return { success: false, error: 'Failed to create account. Please try again.' };
    }

    // If identities is empty, the email is already registered
    if (authData.user.identities && authData.user.identities.length === 0) {
      return { success: false, error: 'An account with this email already exists. Please sign in instead.' };
    }

    // Use the real user id now that we have it
    const uniqueUsername = `${emailUsername}_${authData.user.id.substring(0, 8)}`;

    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.toLowerCase().trim(),
          username: uniqueUsername,
          display_name: displayName.trim() || 'User',
          role: role,
        });

      if (profileError) {
        console.error('Early profile insert FULL error:', JSON.stringify({
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint,
        }, null, 2));
      }
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,
      }
    });

    if (otpError) {
      console.warn('OTP send failed:', otpError);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function verifyOTP(
  email: string,
  token: string,
  roleOverride?: 'guardian' | 'student'
): Promise<{ user: LoggedInUser | null; success: boolean; error?: string }> {
  try {
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

    await new Promise(resolve => setTimeout(resolve, 500));

    // Re-fetch the auth user to ensure we have the latest user_metadata (display_name)
    // since verifyOtp doesn't always return the full metadata from signUp
    const { data: freshAuthData } = await supabase.auth.getUser();
    const authUser = freshAuthData?.user || authData.user;
    const metaDisplayName = authUser.user_metadata?.display_name
      || authData.user.user_metadata?.display_name
      || '';

    let profile = null;

    // Try fetching by id first, then by auth_user_id (handles both schema styles)
    try {
      const { data: byId } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
      if (byId) {
        profile = byId;
      } else {
        const { data: byAuthId } = await supabase
          .from('users')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .maybeSingle();
        profile = byAuthId;
      }
    } catch (err) {
      console.log('Profile fetch failed, will create manually');
    }

    // If we found an existing profile but display_name is missing/generic, patch it
    if (profile && metaDisplayName && (!profile.display_name || profile.display_name === 'User')) {
      await supabase
        .from('users')
        .update({ display_name: metaDisplayName })
        .eq('id', profile.id);
      profile = { ...profile, display_name: metaDisplayName };
    }

    // If roleOverride is provided (from signup flow) and the stored role doesn't match,
    // correct it — this handles the case where the early insert used wrong metadata
    if (profile && roleOverride && profile.role !== roleOverride) {
      await supabase
        .from('users')
        .update({ role: roleOverride })
        .eq('id', profile.id);
      profile = { ...profile, role: roleOverride };
    }

    if (!profile) {
      const emailUsername = email.split('@')[0].toLowerCase();
      const uniqueUsername = `${emailUsername}_${authData.user.id.substring(0, 8)}`;

      const { data: schemaCheck } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      const hasAuthUserIdColumn = schemaCheck && schemaCheck.length > 0 && 'auth_user_id' in schemaCheck[0];

      let insertData: any = {
        email: (authData.user.email || email).toLowerCase().trim(),
        username: uniqueUsername,
        display_name: metaDisplayName || 'User',
        role: roleOverride || authUser.user_metadata?.role || authData.user.user_metadata?.role || 'student',
      };

      // Always set id = authData.user.id so upsert can conflict on 'id'.
      // Also set auth_user_id when the column exists, for backward compat.
      insertData.id = authData.user.id;
      if (hasAuthUserIdColumn) {
        insertData.auth_user_id = authData.user.id;
      }

      // Delete any stale row with the same email before inserting,
      // using the correct identity column for this schema.
      const staleDeleteQuery = supabase
        .from('users')
        .delete()
        .eq('email', (authData.user.email || email).toLowerCase().trim());
      if (hasAuthUserIdColumn) {
        await staleDeleteQuery.neq('auth_user_id', authData.user.id);
      } else {
        await staleDeleteQuery.neq('id', authData.user.id);
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .upsert(insertData, { onConflict: 'id' })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        const user: LoggedInUser = {
          id: authData.user.id,
          email: authData.user.email || email,
          displayName: metaDisplayName || 'User',
          phoneNumber: authData.user.user_metadata?.phone || undefined,
          role: (roleOverride || authUser.user_metadata?.role || authData.user.user_metadata?.role || 'student') as UserRole,
          linkedUserIds: [],
          isLinked: false,
        };
        await setLoggedInUser(user);
        return { user, success: true };
      }

      profile = newProfile;
    }

    const { data: links } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(`guardian_id.eq.${profile.id},student_id.eq.${profile.id}`);

    const linkedUserIds: string[] = [];
    links?.forEach(link => {
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
      phoneNumber: profile.phone_number || undefined,
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

export async function signInWithPin(
  email: string,
  pin: string
): Promise<{ user: LoggedInUser | null; error?: string }> {
  try {
    if (!/^\d{6}$/.test(pin)) {
      return { user: null, error: 'PIN must be exactly 6 digits' };
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: pin,
    });

    if (authError) {
      return { user: null, error: authError.message };
    }

    if (!authData.user) {
      return { user: null, error: 'Login failed' };
    }

    // Try both id and auth_user_id to handle both schema styles
    let profileFoundViaAuthUserId = false;
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!profile) {
      const { data: profileByAuthId } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();
      if (profileByAuthId) {
        profile = profileByAuthId;
        profileFoundViaAuthUserId = true;
      }
    }

    // If profile exists but display_name is missing/generic, patch it from auth metadata
    const metaName = authData.user.user_metadata?.display_name;
    if (profile && metaName && (!profile.display_name || profile.display_name === 'User')) {
      await supabase
        .from('users')
        .update({ display_name: metaName })
        .eq('id', profile.id);
      profile = { ...profile, display_name: metaName };
    }

    let userProfile = profile;
    if (!profile) {
      const emailUsername = email.split('@')[0].toLowerCase();
      const uniqueUsername = `${emailUsername}_${authData.user.id.substring(0, 8)}`;

      const { data: schemaCheck } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      const hasAuthUserIdColumn = schemaCheck && schemaCheck.length > 0 && 'auth_user_id' in schemaCheck[0];

      let insertData: any = {
        email: (authData.user.email || email).toLowerCase().trim(),
        username: uniqueUsername,
        display_name: authData.user.user_metadata?.display_name || 'User',
        role: authData.user.user_metadata?.role || 'student',
      };

      if (hasAuthUserIdColumn) {
        insertData.auth_user_id = authData.user.id;
      } else {
        insertData.id = authData.user.id;
      }

      const { data: newProfile, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        const user: LoggedInUser = {
          id: authData.user.id,
          email: authData.user.email || email,
          displayName: authData.user.user_metadata?.display_name || 'User',
          phoneNumber: authData.user.user_metadata?.phone || undefined,
          role: (authData.user.user_metadata?.role || 'student') as UserRole,
          linkedUserIds: [],
          isLinked: false,
        };
        await setLoggedInUser(user);
        return { user };
      }

      userProfile = newProfile;
    }

    // When the profile was found via auth_user_id (old schema), the table's
    // own UUID differs from auth.uid(). We store auth.uid() as user.id so
    // that RLS policies (which check auth.uid()) align correctly.
    const effectiveId = profileFoundViaAuthUserId ? authData.user.id : userProfile.id;

    // Query with both the auth UUID and profile table UUID so we find the link
    // regardless of which ID was stored when the link was created.
    const candidateIds = Array.from(
      new Set([authData.user.id, userProfile.id].filter(Boolean) as string[])
    );
    const orFilter = candidateIds
      .flatMap(id => [`guardian_id.eq.${id}`, `student_id.eq.${id}`])
      .join(',');

    const { data: links } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(orFilter);

    const linkedUserIds: string[] = [];
    links?.forEach(link => {
      if (candidateIds.includes(link.guardian_id) && link.student_id) {
        if (!linkedUserIds.includes(link.student_id)) linkedUserIds.push(link.student_id);
      }
      if (candidateIds.includes(link.student_id) && link.guardian_id) {
        if (!linkedUserIds.includes(link.guardian_id)) linkedUserIds.push(link.guardian_id);
      }
    });

    const user: LoggedInUser = {
      id: effectiveId,
      email: userProfile.email,
      displayName: userProfile.display_name,
      phoneNumber: userProfile.phone_number || undefined,
      role: userProfile.role as UserRole,
      linkedUserIds: linkedUserIds,
      isLinked: linkedUserIds.length > 0,
    };

    await setLoggedInUser(user);
    return { user };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

// Alias for backward compatibility
export const signUpWithOTP = signUpWithPinAndOTP;
export const signIn = signInWithPin;

/**
 * Rebuild a LoggedInUser from an existing Supabase session user object.
 * Called when AsyncStorage is empty but Supabase has restored a valid auth
 * session (common on Android after AsyncStorage is cleared). Saves the result
 * to AsyncStorage so subsequent app opens don't need to repeat this.
 */
export async function signInFromSession(
  sessionUser: { id: string; email?: string; user_metadata?: any }
): Promise<LoggedInUser | null> {
  try {
    console.log('[signInFromSession] rebuilding from session, auth id:', sessionUser.id);

    // Try both schema styles
    let profileFoundViaAuthUserId = false;
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (!profile) {
      const { data: profileByAuthId } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', sessionUser.id)
        .maybeSingle();
      if (profileByAuthId) {
        profile = profileByAuthId;
        profileFoundViaAuthUserId = true;
      }
    }

    console.log('[signInFromSession] profile found:', profile ? `id=${profile.id} role=${profile.role}` : 'NULL', 'viaAuthUserId:', profileFoundViaAuthUserId);

    if (!profile) {
      // No profile row — can't rebuild
      console.warn('[signInFromSession] no profile row found, cannot rebuild');
      return null;
    }

    const effectiveId = profileFoundViaAuthUserId ? sessionUser.id : profile.id;

    // Resolve link status using both candidate IDs
    const candidateIds = Array.from(new Set([sessionUser.id, profile.id].filter(Boolean) as string[]));
    const orFilter = candidateIds.flatMap(id => [`guardian_id.eq.${id}`, `student_id.eq.${id}`]).join(',');
    const { data: links } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(orFilter);

    console.log('[signInFromSession] candidateIds:', candidateIds, 'links found:', JSON.stringify(links));

    const linkedUserIds: string[] = [];
    links?.forEach(link => {
      if (candidateIds.includes(link.guardian_id) && link.student_id) {
        if (!linkedUserIds.includes(link.student_id)) linkedUserIds.push(link.student_id);
      }
      if (candidateIds.includes(link.student_id) && link.guardian_id) {
        if (!linkedUserIds.includes(link.guardian_id)) linkedUserIds.push(link.guardian_id);
      }
    });

    const user: LoggedInUser = {
      id: effectiveId,
      email: profile.email || sessionUser.email || '',
      displayName: profile.display_name || sessionUser.user_metadata?.display_name || 'User',
      phoneNumber: profile.phone_number || sessionUser.user_metadata?.phone || undefined,
      role: (profile.role || sessionUser.user_metadata?.role || 'student') as UserRole,
      linkedUserIds,
      isLinked: linkedUserIds.length > 0,
    };

    await setLoggedInUser(user);
    console.log('[signInFromSession] saved user to AsyncStorage, isLinked:', user.isLinked);
    return user;
  } catch (err: any) {
    console.error('[signInFromSession] error:', err.message);
    return null;
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await setLoggedInUser(null);
}

export async function resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'allowancemanager://reset-password',
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ==================== ACCOUNT LINKING ====================

export async function sendStudentInvite(
  studentEmail: string
): Promise<{ success: boolean; error?: string; inviteId?: string }> {
  try {
    const user = await getLoggedInUser();
    if (!user || user.role !== 'guardian') {
      return { success: false, error: 'Only guardians can send invites' };
    }

    // Try to find student in users table (try with and without role filter)
    let studentUser: { id: string; email: string; role: string } | null = null;

    const normalizedEmail = studentEmail.toLowerCase().trim();

    const { data: studentWithRole, error: e1 } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', normalizedEmail)
      .eq('role', 'student')
      .maybeSingle();

    if (studentWithRole) {
      studentUser = studentWithRole;
    } else {
      // Fallback: find by email regardless of role
      const { data: studentAny, error: e2 } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', normalizedEmail)
        .maybeSingle();
  
      if (studentAny) {
        studentUser = studentAny;
      }
    }

    if (!studentUser) {
      return { success: false, error: `No account found with email "${normalizedEmail}". Make sure the student has signed up and verified their account first.` };
    }

    if (studentUser.role === 'guardian') {
      return { success: false, error: 'This account is a guardian account, not a student account.' };
    }

    const { data: existingLink } = await supabase
      .from('user_links')
      .select('*')
      .eq('guardian_id', user.id)
      .eq('student_id', studentUser.id)
      .maybeSingle();

    if (existingLink) {
      // Link exists in DB — sync local state so the app reflects this correctly
      const { data: allLinks } = await supabase
        .from('user_links')
        .select('guardian_id, student_id')
        .or(`guardian_id.eq.${user.id},student_id.eq.${user.id}`);

      const linkedUserIds: string[] = [];
      allLinks?.forEach(link => {
        if (link.guardian_id === user.id && link.student_id) linkedUserIds.push(link.student_id);
        if (link.student_id === user.id && link.guardian_id) linkedUserIds.push(link.guardian_id);
      });

      const updatedUser: LoggedInUser = {
        ...user,
        linkedUserIds,
        isLinked: linkedUserIds.length > 0,
      };
      await setLoggedInUser(updatedUser);

      return { success: false, error: 'Already linked to this student — your account has been refreshed. Please go back to your dashboard.' };
    }

    // Resolve the actual `users` table UUID for the guardian.
    // user.id from AsyncStorage may be the auth UUID; pending_invites.guardian_id
    // is a FK to users.id (the table's own row UUID), which can differ.
    const [profileById, profileByAuthId] = await Promise.all([
      supabase.from('users').select('id').eq('id', user.id).maybeSingle(),
      supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle(),
    ]);
    const guardianTableId = profileById.data?.id ?? profileByAuthId.data?.id ?? user.id;

    const { data: invite, error: inviteError } = await supabase
      .from('pending_invites')
      .insert({
        guardian_id: guardianTableId,
        guardian_email: user.email,
        guardian_name: user.displayName,
        student_email: studentEmail,
        student_id: studentUser.id,
        status: 'pending',
      })
      .select()
      .single();

    if (inviteError) {
      return { success: false, error: inviteError.message };
    }

    return { success: true, inviteId: invite.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingInvites(): Promise<PendingInvite[]> {
  const user = await getLoggedInUser();
  if (!user || user.role !== 'student') return [];

  const { data, error } = await supabase
    .from('pending_invites')
    .select('*')
    .eq('student_email', user.email)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invites:', error);
    return [];
  }

  return (data || []).map(invite => ({
    id: invite.id,
    guardianId: invite.guardian_id,
    guardianEmail: invite.guardian_email,
    guardianName: invite.guardian_name,
    studentEmail: invite.student_email,
    status: invite.status,
    createdAt: invite.created_at,
  }));
}

// FIX #4: removed signIn(user.email, '') call with empty PIN — now uses existing session to refresh
export async function acceptInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getLoggedInUser();
    if (!user || user.role !== 'student') {
      return { success: false, error: 'Only students can accept invites' };
    }

    const { data: invite, error: inviteError } = await supabase
      .from('pending_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      return { success: false, error: 'Invite not found' };
    }

    console.log('[acceptInvite] === DIAGNOSTIC START ===');
    console.log('[acceptInvite] user.id (from AsyncStorage):', user.id);
    console.log('[acceptInvite] invite.guardian_id:', invite.guardian_id);
    console.log('[acceptInvite] invite.student_id:', invite.student_id);

    // Resolve the actual users table UUID for the student.
    const [profileById, profileByAuthId] = await Promise.all([
      supabase.from('users').select('id, auth_user_id').eq('id', user.id).maybeSingle(),
      supabase.from('users').select('id, auth_user_id').eq('auth_user_id', user.id).maybeSingle(),
    ]);
    console.log('[acceptInvite] profileById.data:', JSON.stringify(profileById.data));
    console.log('[acceptInvite] profileByAuthId.data:', JSON.stringify(profileByAuthId.data));

    const studentTableId = profileById.data?.id ?? profileByAuthId.data?.id ?? user.id;
    console.log('[acceptInvite] studentTableId resolved to:', studentTableId);

    // Dump what's currently in user_links before insert
    const { data: existingLinks } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(`guardian_id.eq.${invite.guardian_id},student_id.eq.${studentTableId},student_id.eq.${user.id}`);
    console.log('[acceptInvite] existing user_links rows before insert:', JSON.stringify(existingLinks));

    // Try RPC first (SECURITY DEFINER bypasses RLS)
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('insert_user_link', {
        p_guardian_id: invite.guardian_id,
        p_student_id: studentTableId,
      });
    console.log('[acceptInvite] RPC result — data:', JSON.stringify(rpcData), 'error:', rpcError?.message ?? 'none');

    if (rpcError) {
      console.warn('[acceptInvite] RPC failed, trying direct insert:', rpcError.message);

      // Fallback: direct insert WITHOUT status column (user_links only has guardian_id + student_id)
      const { data: directData, error: directError } = await supabase
        .from('user_links')
        .upsert(
          { guardian_id: invite.guardian_id, student_id: studentTableId },
          { onConflict: 'guardian_id,student_id', ignoreDuplicates: true }
        )
        .select();
      console.log('[acceptInvite] direct insert result — data:', JSON.stringify(directData), 'error:', directError?.message ?? 'none');

      if (directError) {
        if (!directError.message?.includes('duplicate') && !directError.code?.includes('23505')) {
          console.error('[acceptInvite] Direct insert also failed:', directError.message);
          return { success: false, error: directError.message };
        }
      }
    }

    // Mark invite as accepted
    await supabase
      .from('pending_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    // Dump ALL rows in user_links after insert to see exactly what was stored
    const { data: allLinks } = await supabase
      .from('user_links')
      .select('guardian_id, student_id');
    console.log('[acceptInvite] ALL user_links rows after insert:', JSON.stringify(allLinks));

    // Query with ALL possible student UUIDs
    const candidateStudentIds = Array.from(
      new Set([user.id, studentTableId].filter(Boolean) as string[])
    );
    const orFilter = candidateStudentIds
      .flatMap(id => [`guardian_id.eq.${id}`, `student_id.eq.${id}`])
      .join(',');
    console.log('[acceptInvite] candidateStudentIds:', candidateStudentIds);
    console.log('[acceptInvite] orFilter for link query:', orFilter);

    const { data: links } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(orFilter);
    console.log('[acceptInvite] links found by orFilter:', JSON.stringify(links));

    const linkedUserIds: string[] = [];
    links?.forEach(link => {
      if (candidateStudentIds.includes(link.guardian_id) && link.student_id) {
        if (!linkedUserIds.includes(link.student_id)) linkedUserIds.push(link.student_id);
      }
      if (candidateStudentIds.includes(link.student_id) && link.guardian_id) {
        if (!linkedUserIds.includes(link.guardian_id)) linkedUserIds.push(link.guardian_id);
      }
    });
    console.log('[acceptInvite] final linkedUserIds:', linkedUserIds);
    console.log('[acceptInvite] isLinked will be:', linkedUserIds.length > 0);
    console.log('[acceptInvite] === DIAGNOSTIC END ===');

    const updatedUser: LoggedInUser = {
      ...user,
      linkedUserIds,
      isLinked: linkedUserIds.length > 0,
    };
    await setLoggedInUser(updatedUser);

    return { success: true };
  } catch (error: any) {
    console.error('[acceptInvite] EXCEPTION:', error.message);
    return { success: false, error: error.message };
  }
}

export async function rejectInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('pending_invites')
    .update({ status: 'rejected' })
    .eq('id', inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function getLinkedStudents(): Promise<LoggedInUser[]> {
  const user = await getLoggedInUser();
  if (!user || user.role !== 'guardian') return [];

  // Build all possible guardian IDs — the row may have been inserted with
  // either the auth UUID or the profile table UUID, so query with both.
  const [profileById, profileByAuthId] = await Promise.all([
    supabase.from('users').select('id').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle(),
  ]);
  const profileTableId = profileByAuthId.data?.id;
  const guardianCandidateIds = Array.from(
    new Set([user.id, profileTableId].filter(Boolean) as string[])
  );

  // Use .in() so we match regardless of which UUID was stored in guardian_id
  const { data: links } = await supabase
    .from('user_links')
    .select(`
      guardian_id,
      student_id,
      users!user_links_student_id_fkey (
        id,
        email,
        display_name,
        role,
        phone_number
      )
    `)
    .in('guardian_id', guardianCandidateIds);

  if (!links) return [];

  return links.map((link: any) => ({
    id: link.users.id,
    email: link.users.email,
    displayName: link.users.display_name,
    phoneNumber: link.users.phone_number || undefined,
    role: link.users.role,
    linkedUserIds: [user.id],
    isLinked: true,
  }));
}

export async function unlinkStudent(studentId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getLoggedInUser();
  if (!user || user.role !== 'guardian') {
    return { success: false, error: 'Only guardians can unlink students' };
  }

  // Resolve all possible guardian IDs (auth UUID and profile UUID) so we delete
  // the row regardless of which UUID was stored when the link was created.
  const [profileById, profileByAuthId] = await Promise.all([
    supabase.from('users').select('id').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle(),
  ]);
  const profileTableId = profileByAuthId.data?.id;
  const guardianCandidateIds = Array.from(
    new Set([user.id, profileTableId].filter(Boolean) as string[])
  );

  const { error } = await supabase
    .from('user_links')
    .delete()
    .in('guardian_id', guardianCandidateIds)
    .eq('student_id', studentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ==================== USER MANAGEMENT ====================

export async function getLoggedInUser(): Promise<LoggedInUser | null> {
  const val = await AsyncStorage.getItem(KEYS.LOGGED_IN_USER);
  return val ? JSON.parse(val) : null;
}

// Re-fetches link status AND display name from Supabase on app load to fix stale AsyncStorage
export async function refreshUserLinkStatus(user: LoggedInUser): Promise<LoggedInUser> {
  try {
    // Fetch profile first (try both id and auth_user_id), including the table's own `id`
    const [profileByIdResult, profileByAuthIdResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, role')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('users')
        .select('id, display_name, role')
        .eq('auth_user_id', user.id)
        .maybeSingle(),
    ]);

    const freshProfile = profileByIdResult.data || profileByAuthIdResult.data;

    console.log('[refreshUserLinkStatus] user.id:', user.id);
    console.log('[refreshUserLinkStatus] profileById:', JSON.stringify(profileByIdResult.data));
    console.log('[refreshUserLinkStatus] profileByAuthId:', JSON.stringify(profileByAuthIdResult.data));
    console.log('[refreshUserLinkStatus] freshProfile:', JSON.stringify(freshProfile));

    // Build a set of all possible IDs this user could be stored as in user_links.
    // acceptInvite may have inserted with either the auth UUID or the profile table UUID
    // depending on which schema was active and which code path ran. Querying with
    // both IDs guarantees we find the row regardless of which was stored.
    const profileTableId = freshProfile?.id;
    const candidateIds = Array.from(
      new Set([user.id, profileTableId].filter(Boolean) as string[])
    );
    const orFilter = candidateIds
      .flatMap(id => [`guardian_id.eq.${id}`, `student_id.eq.${id}`])
      .join(',');

    // Dump ALL rows in user_links so we can see exactly what's stored
    const { data: allUserLinks } = await supabase
      .from('user_links')
      .select('guardian_id, student_id');
    console.log('[refreshUserLinkStatus] ALL user_links rows in DB:', JSON.stringify(allUserLinks));
    console.log('[refreshUserLinkStatus] candidateIds we are querying with:', candidateIds);
    console.log('[refreshUserLinkStatus] orFilter:', orFilter);

    const { data: links, error: linksError } = await supabase
      .from('user_links')
      .select('guardian_id, student_id')
      .or(orFilter);
    console.log('[refreshUserLinkStatus] links found:', JSON.stringify(links), 'error:', linksError?.message ?? 'none');

    // The ID that was actually stored in the matched row is what we should use
    // to identify ourselves, so linkedUserIds contains the *other* side.
    const linkedUserIds: string[] = [];
    links?.forEach(link => {
      // Check both possible self-IDs so we handle whichever UUID was stored
      if (candidateIds.includes(link.guardian_id) && link.student_id) {
        if (!linkedUserIds.includes(link.student_id)) linkedUserIds.push(link.student_id);
      }
      if (candidateIds.includes(link.student_id) && link.guardian_id) {
        if (!linkedUserIds.includes(link.guardian_id)) linkedUserIds.push(link.guardian_id);
      }
    });

    const freshDisplayName =
      freshProfile?.display_name && freshProfile.display_name !== 'User'
        ? freshProfile.display_name
        : user.displayName;

    console.log('[refreshUserLinkStatus] candidateIds used:', candidateIds);
    console.log('[refreshUserLinkStatus] orFilter:', orFilter);
    console.log('[refreshUserLinkStatus] linkedUserIds found:', linkedUserIds);
    console.log('[refreshUserLinkStatus] freshDisplayName chosen:', freshDisplayName);

    const updatedUser: LoggedInUser = {
      ...user,
      displayName: freshDisplayName,
      linkedUserIds,
      isLinked: linkedUserIds.length > 0,
    };

    await setLoggedInUser(updatedUser);
    return updatedUser;
  } catch {
    // If Supabase call fails, fall back to cached value
    return user;
  }
}

export async function setLoggedInUser(user: LoggedInUser | null): Promise<void> {
  if (user) {
    await AsyncStorage.setItem(KEYS.LOGGED_IN_USER, JSON.stringify(user));
    await setRole(user.role);
    await setCurrentUserId(user.id);
  } else {
    await AsyncStorage.removeItem(KEYS.LOGGED_IN_USER);
    await setRole(null);
    await setCurrentUserId(null);
  }
}

export async function getRole(): Promise<UserRole> {
  const role = await AsyncStorage.getItem(KEYS.ROLE);
  return (role as UserRole) || null;
}

export async function setRole(role: UserRole): Promise<void> {
  if (role) {
    await AsyncStorage.setItem(KEYS.ROLE, role);
  } else {
    await AsyncStorage.removeItem(KEYS.ROLE);
  }
}

// ==================== WALLET MANAGEMENT ====================

/**
 * Resolves the actual public.users table `id` for a given auth-or-profile UUID.
 *
 * Some accounts were created under an older schema where `users.auth_user_id = auth.uid()`
 * and `users.id` is an independent UUID. Wallet FK constraints reference `users.id`,
 * so passing the auth UUID for old-schema accounts causes 23503/23505 errors.
 * This helper always returns the real row `id` regardless of schema.
 */
async function resolveProfileId(candidateId: string): Promise<string | null> {
  const { data: byId } = await supabase
    .from('users').select('id').eq('id', candidateId).maybeSingle();
  if (byId) return byId.id;

  const { data: byAuthId } = await supabase
    .from('users').select('id').eq('auth_user_id', candidateId).maybeSingle();
  if (byAuthId) return byAuthId.id;

  return null;
}

export async function getGuardianWallet(): Promise<number> {
  const user = await getLoggedInUser();
  if (!user) return 0;

  const rawId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!rawId) return 0;

  const guardianId = await resolveProfileId(rawId);
  if (!guardianId) return 0;

  const { data, error } = await supabase
    .rpc('get_or_create_wallet', { p_user_id: guardianId });

  if (error) {
    console.error('Error fetching guardian wallet:', error);
    return 0;
  }

  return data?.[0]?.balance || 0;
}

export async function setGuardianWallet(amount: number): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  const rawId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!rawId) return;

  const guardianId = await resolveProfileId(rawId);
  if (!guardianId) return;

  const { error } = await supabase
    .from('wallets')
    .update({ balance: amount, updated_at: new Date().toISOString() })
    .eq('user_id', guardianId);

  if (error) {
    console.error('Error updating guardian wallet:', error);
  }
}

// Atomically add an amount to the guardian wallet.
// Tries the deposit_to_wallet RPC first; if that doesn't exist or fails,
// falls back to a manual read-then-update so the deposit always goes through.
export async function depositToGuardianWallet(amount: number): Promise<number> {
  const user = await getLoggedInUser();
  if (!user) throw new Error('Not logged in');

  const rawId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!rawId) throw new Error('No guardian account found');

  const guardianId = await resolveProfileId(rawId);
  if (!guardianId) throw new Error('Could not resolve wallet owner — please re-login and try again');

  // --- Try atomic RPC first ---
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('deposit_to_wallet', { p_user_id: guardianId, p_amount: amount });

  if (!rpcError && rpcData != null) {
    // RPC exists and succeeded — return new balance
    return rpcData as number;
  }

  // --- Fallback: manual balance read + update ---
  // This handles the case where deposit_to_wallet RPC hasn't been created in Supabase yet.
  const { data: walletRows, error: getErr } = await supabase
    .rpc('get_or_create_wallet', { p_user_id: guardianId });

  if (getErr) throw new Error(`Could not read wallet: ${getErr.message}`);

  const currentBalance: number = walletRows?.[0]?.balance ?? 0;
  const newBalance = currentBalance + amount;

  const { error: updateErr } = await supabase
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', guardianId);

  if (updateErr) throw new Error(`Could not update wallet balance: ${updateErr.message}`);

  return newBalance;
}

export async function getStudentWallet(studentId?: string): Promise<number> {
  const user = await getLoggedInUser();
  if (!user) return 0;

  const rawId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!rawId) return 0;

  const targetStudentId = await resolveProfileId(rawId);
  if (!targetStudentId) return 0;

  const { data, error } = await supabase
    .rpc('get_or_create_wallet', { p_user_id: targetStudentId });

  if (error) {
    console.error('Error fetching student wallet:', error);
    return 0;
  }

  return data?.[0]?.balance || 0;
}

export async function setStudentWallet(amount: number, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  const rawId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!rawId) return;

  const targetStudentId = (await resolveProfileId(rawId)) ?? rawId;

  const { error } = await supabase
    .from('wallets')
    .upsert({ user_id: targetStudentId, balance: amount }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error updating student wallet:', error);
  }
}

// FIX #7: Changed .single() → .maybeSingle() to prevent PGRST116 crashes
export async function getAllowanceConfig(studentId?: string): Promise<AllowanceConfig | null> {
  const user = await getLoggedInUser();
  if (!user) return null;

  const rawGuardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  // Always resolve a specific student — never query without student_id filter
  // (a guardian has one row per student, querying without filter returns multiple rows)
  const rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);

  if (!rawGuardianId || !rawStudentId) return null;

  // Resolve both IDs to actual users table PKs
  const [guardianId, studentTableId] = await Promise.all([
    resolveProfileId(rawGuardianId).then(r => r ?? rawGuardianId),
    resolveProfileId(rawStudentId).then(r => r ?? rawStudentId),
  ]);

  // Always filter by BOTH guardian_id AND student_id — exactly one row expected
  const { data, error } = await supabase
    .from('allowance_configs')
    .select('*')
    .eq('guardian_id', guardianId)
    .eq('student_id', studentTableId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching allowance config:', error);
    return null;
  }

  if (!data) return null;

  return {
    amount: parseFloat(data.amount.toString()),
    frequency: data.frequency as 'daily' | 'weekly' | 'biweekly' | 'monthly',
    dayOfWeek: data.day_of_week,
    isActive: data.is_active,
  };
}

export async function setAllowanceConfig(config: AllowanceConfig, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  const rawGuardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  const rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);

  if (!rawGuardianId || !rawStudentId) return;

  // Resolve auth UUIDs -> actual profile PKs to satisfy FK constraints
  const [resolvedGuardianId, resolvedStudentId] = await Promise.all([
    resolveProfileId(rawGuardianId),
    resolveProfileId(rawStudentId),
  ]);

  const guardianId = resolvedGuardianId ?? rawGuardianId;
  const targetStudentId = resolvedStudentId ?? rawStudentId;

  const { error } = await supabase
    .from('allowance_configs')
    .upsert({
      guardian_id: guardianId,
      student_id: targetStudentId,
      amount: config.amount,
      frequency: config.frequency,
      day_of_week: config.dayOfWeek,
      is_active: config.isActive,
    }, {
      onConflict: 'guardian_id,student_id'
    });

  if (error) {
    console.error('Error setting allowance config:', error);
  }
}

export async function getTransactions(studentId?: string): Promise<Transaction[]> {
  const user = await getLoggedInUser();
  if (!user) return [];

  // For students: only fetch transactions involving THEIR own ID.
  // Using all linkedUserIds (which includes the guardian) causes the student
  // to see transactions from ALL of the guardian's other linked students.
  // For guardians: if a specific studentId is passed, scope to that pair only;
  // otherwise fetch all transactions involving the guardian and any linked student.
  let rawIds: string[];
  if (user.role === 'student') {
    rawIds = [user.id];
    // Also include the guardian ID so allowance transfers (from guardian to student) show up
    if (user.linkedUserIds?.length) rawIds.push(...user.linkedUserIds);
  } else {
    rawIds = [user.id, ...(user.linkedUserIds || [])];
    if (studentId) rawIds.push(studentId);
  }

  // Resolve each raw ID to its actual profile PK (handles both schema styles)
  const resolvedSets = await Promise.all(rawIds.map(async (rawId) => {
    const profileId = await resolveProfileId(rawId);
    return profileId && profileId !== rawId ? [rawId, profileId] : [rawId];
  }));
  const allIds = [...new Set(resolvedSets.flat())];

  // For students: only return transactions where THEY are from_user or to_user.
  // This prevents leaking other students' transactions that share the same guardian.
  let studentOwnIds: string[] = [];
  if (user.role === 'student') {
    const resolved = await resolveProfileId(user.id);
    studentOwnIds = resolved && resolved !== user.id ? [user.id, resolved] : [user.id];
  }

  // Deposits have to_user_id = null, so we must also explicitly include them
  // by querying: (from_user_id IN allIds) OR (to_user_id IN allIds)
  // Supabase .in() won't match NULL rows, so we run two queries and merge.
  const [regularData, depositData] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.in.(${allIds.join(',')}),to_user_id.in.(${allIds.join(',')})`)
      .order('created_at', { ascending: false }),
    supabase
      .from('transactions')
      .select('*')
      .in('from_user_id', allIds)
      .eq('type', 'deposit')
      .order('created_at', { ascending: false }),
  ]);

  const error = regularData.error || depositData.error;
  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  // Merge and deduplicate by id
  // For students: also filter out transactions that don't involve them directly
  // (this removes other students' transactions that share the same guardian)
  const seen = new Set<string>();
  const merged = [...(regularData.data || []), ...(depositData.data || [])].filter(tx => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    // Student scope filter: only keep txns where the student is from or to
    if (user.role === 'student' && studentOwnIds.length > 0) {
      const involvesStudent =
        studentOwnIds.includes(tx.from_user_id) ||
        studentOwnIds.includes(tx.to_user_id);
      if (!involvesStudent) return false;
    }
    return true;
  });
  // Re-sort merged results newest first
  const data = merged.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return data.map(tx => ({
    id: tx.id,
    referenceId: tx.reference_id || `TXN-${tx.id.substring(0, 8).toUpperCase()}`,
    type: tx.type as 'deposit' | 'allowance' | 'expense',
    amount: parseFloat(tx.amount.toString()),
    description: tx.description,
    category: tx.category || undefined,
    date: tx.created_at,
    from: tx.from_user_id
      ? ((user.linkedUserIds || []).some(lid => allIds.includes(lid) && lid === tx.from_user_id)
          ? (user.role === 'guardian' ? 'student' : 'guardian')
          : (user.role === 'guardian' ? 'guardian' : 'student'))
      : undefined,
    to: tx.to_user_id
      ? ((user.linkedUserIds || []).some(lid => allIds.includes(lid) && lid === tx.to_user_id)
          ? (user.role === 'guardian' ? 'student' : 'guardian')
          : (user.role === 'guardian' ? 'guardian' : 'student'))
      : undefined,
    toUserId: tx.to_user_id ?? undefined,
    fromUserId: tx.from_user_id ?? undefined,
  }));
}

// FIX #3: accepts Omit<Transaction, 'id' | 'referenceId'> — id and referenceId are auto-generated
export async function addTransaction(tx: Omit<Transaction, 'id' | 'referenceId'>, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  const rawGuardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  const rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);

  // Resolve auth UUIDs → actual users table PKs to satisfy FK constraints on transactions
  const [resolvedGuardianId, resolvedStudentId] = await Promise.all([
    rawGuardianId ? resolveProfileId(rawGuardianId) : Promise.resolve(null),
    rawStudentId ? resolveProfileId(rawStudentId) : Promise.resolve(null),
  ]);

  const guardianId = resolvedGuardianId ?? rawGuardianId ?? null;
  const targetStudentId = resolvedStudentId ?? rawStudentId ?? null;

  // For deposits: no recipient — money just goes into the guardian's wallet
  // Setting to_user_id = null avoids FK mismatches and correctly represents wallet top-ups
  const fromUserId = tx.from === 'guardian' ? guardianId : tx.from === 'student' ? targetStudentId : null;
  const toUserId = tx.type === 'deposit' ? null : (tx.to === 'guardian' ? guardianId : tx.to === 'student' ? targetStudentId : null);

  const { error } = await supabase
    .from('transactions')
    .insert({
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category || null,
      from_user_id: fromUserId,
      to_user_id: toUserId,
      created_at: tx.date,
    });

  if (error) {
    console.error('Error adding transaction:', error);
    throw new Error(`Failed to record transaction: ${error.message}`);
  }
}

export async function getSavingsGoals(studentId?: string): Promise<SavingsGoal[]> {
  const user = await getLoggedInUser();
  if (!user) return [];

  let targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!targetStudentId) return [];

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('student_id', targetStudentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching savings goals:', error);
    return [];
  }

  return (data || []).map(goal => ({
    id: goal.id,
    name: goal.name,
    targetAmount: parseFloat(goal.target_amount.toString()),
    currentAmount: parseFloat(goal.current_amount.toString()),
    iconName: goal.icon_name,
    createdAt: goal.created_at,
    deadline: goal.deadline ?? null,
    isLocked: goal.is_locked ?? false,
    lockedBy: goal.locked_by ?? null,
  }));
}

export async function setSavingsGoals(goals: SavingsGoal[], studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  let targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!targetStudentId) return;

  await supabase
    .from('savings_goals')
    .delete()
    .eq('student_id', targetStudentId);

  if (goals.length > 0) {
    const { error } = await supabase
      .from('savings_goals')
      .insert(goals.map(goal => ({
        id: goal.id,
        student_id: targetStudentId!,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        icon_name: goal.iconName,
        created_at: goal.createdAt,
      })));

    if (error) {
      console.error('Error setting savings goals:', error);
    }
  }
}

// FIX: Dedicated insert for a single new goal — avoids the delete+reinsert race condition
export async function insertSavingsGoal(goal: SavingsGoal, studentId?: string): Promise<boolean> {
  const user = await getLoggedInUser();
  if (!user) return false;

  const targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!targetStudentId) return false;

  const { error } = await supabase
    .from('savings_goals')
    .insert({
      id: goal.id,
      student_id: targetStudentId,
      name: goal.name,
      target_amount: goal.targetAmount,
      current_amount: goal.currentAmount,
      icon_name: goal.iconName,
      created_at: goal.createdAt,
      deadline: goal.deadline ?? null,
      is_locked: goal.isLocked ?? false,
      locked_by: goal.lockedBy ?? null,
    });

  if (error) {
    console.error('Error inserting savings goal:', error);
    return false;
  }
  return true;
}

// FIX: Update only the current_amount of a single goal — avoids the delete+reinsert race condition
export async function updateGoalAmount(goalId: string, newAmount: number): Promise<boolean> {
  const { error } = await supabase
    .from('savings_goals')
    .update({ current_amount: newAmount })
    .eq('id', goalId);

  if (error) {
    console.error('Error updating goal amount:', error);
    return false;
  }
  return true;
}

// FIX: Delete a single goal by id — avoids the delete+reinsert race condition
export async function deleteSavingsGoalById(goalId: string): Promise<boolean> {
  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', goalId);

  if (error) {
    console.error('Error deleting savings goal:', error);
    return false;
  }
  return true;
}

/** Guardian locks a goal — student cannot withdraw while locked */
export async function lockSavingsGoal(goalId: string, lockedByName: string): Promise<boolean> {
  // Try SECURITY DEFINER RPC first (bypasses RLS for guardian→student updates)
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('guardian_lock_goal', { p_goal_id: goalId, p_locked_by: lockedByName, p_is_locked: true });
  if (!rpcError) return rpcResult === true;

  // RPC not yet created — fall back to direct update
  console.warn('guardian_lock_goal RPC unavailable, trying direct update:', rpcError.message);
  const user = await getLoggedInUser();
  if (!user) return false;
  const rawStudentId = user.role === 'guardian' ? user.linkedUserIds?.[0] : user.id;
  if (!rawStudentId) return false;
  const studentId = await resolveProfileId(rawStudentId) ?? rawStudentId;
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ is_locked: true, locked_by: lockedByName })
    .eq('id', goalId).eq('student_id', studentId).select('id');
  if (error) { console.error('Error locking goal:', error); return false; }
  if (!data || data.length === 0) { console.error('lockSavingsGoal: 0 rows — run supabase_guardian_goals_rls.sql in Supabase SQL Editor'); return false; }
  return true;
}

/** Guardian unlocks a goal */
export async function unlockSavingsGoal(goalId: string): Promise<boolean> {
  // Try SECURITY DEFINER RPC first (bypasses RLS for guardian→student updates)
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('guardian_lock_goal', { p_goal_id: goalId, p_locked_by: '', p_is_locked: false });
  if (!rpcError) return rpcResult === true;

  // RPC not yet created — fall back to direct update
  console.warn('guardian_lock_goal RPC unavailable, trying direct update:', rpcError.message);
  const user = await getLoggedInUser();
  if (!user) return false;
  const rawStudentId = user.role === 'guardian' ? user.linkedUserIds?.[0] : user.id;
  if (!rawStudentId) return false;
  const studentId = await resolveProfileId(rawStudentId) ?? rawStudentId;
  const { data, error } = await supabase
    .from('savings_goals')
    .update({ is_locked: false, locked_by: null })
    .eq('id', goalId).eq('student_id', studentId).select('id');
  if (error) { console.error('Error unlocking goal:', error); return false; }
  if (!data || data.length === 0) { console.error('unlockSavingsGoal: 0 rows — run supabase_guardian_goals_rls.sql in Supabase SQL Editor'); return false; }
  return true;
}

/** Guardian co-contributes to a student's goal (deducts from guardian wallet, adds to goal) */
export async function coContributeToGoal(
  goalId: string,
  amount: number,
  goalName: string,
  studentId?: string,
): Promise<boolean> {
  const user = await getLoggedInUser();
  if (!user) return false;

  const rawGuardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!rawGuardianId) return false;
  const guardianId = await resolveProfileId(rawGuardianId) ?? rawGuardianId;

  // Resolve student ID
  const rawStudentId = studentId || user.linkedUserIds[0];
  if (!rawStudentId) return false;
  const targetStudentId = await resolveProfileId(rawStudentId) ?? rawStudentId;

  // Get current guardian wallet
  const { data: walletRows } = await supabase.rpc('get_or_create_wallet', { p_user_id: guardianId });
  const guardianBalance: number = walletRows?.[0]?.balance ?? 0;
  if (guardianBalance < amount) return false;

  // Get current goal — cap contribution at remaining gap
  const { data: goalData } = await supabase
    .from('savings_goals')
    .select('current_amount, target_amount')
    .eq('id', goalId)
    .maybeSingle();
  if (!goalData) return false;

  const currentGoalAmount = parseFloat(goalData.current_amount.toString());
  const targetGoalAmount  = parseFloat(goalData.target_amount.toString());
  const remaining         = targetGoalAmount - currentGoalAmount;
  if (remaining <= 0) return false;

  const actual = Math.min(amount, remaining);

  // 1. Deduct from guardian wallet
  const { error: guardianWalletErr } = await supabase
    .from('wallets')
    .update({ balance: guardianBalance - actual, updated_at: new Date().toISOString() })
    .eq('user_id', guardianId);
  if (guardianWalletErr) { console.error('coContribute: guardian wallet deduct failed', guardianWalletErr); return false; }

  // 2. Credit student wallet first (same path as sendAllowanceNow — works under guardian auth)
  const { data: sWalletRows } = await supabase.rpc('get_or_create_wallet', { p_user_id: targetStudentId });
  const studentBalance: number = sWalletRows?.[0]?.balance ?? 0;
  const { error: studentWalletErr } = await supabase
    .from('wallets')
    .upsert({ user_id: targetStudentId, balance: studentBalance + actual }, { onConflict: 'user_id' });
  if (studentWalletErr) {
    console.error('coContribute: student wallet credit failed', studentWalletErr);
    // Refund guardian
    await supabase.from('wallets').update({ balance: guardianBalance, updated_at: new Date().toISOString() }).eq('user_id', guardianId);
    return false;
  }

  // 3. Update goal amount via SECURITY DEFINER RPC (bypasses RLS)
  const { data: rpcGoalResult, error: rpcGoalErr } = await supabase
    .rpc('guardian_update_goal_amount', {
      p_goal_id: goalId,
      p_new_amount: currentGoalAmount + actual,
    });

  let goalErr: any = null;
  if (rpcGoalErr) {
    // RPC not yet available — try direct update with student_id filter
    console.warn('guardian_update_goal_amount RPC unavailable, trying direct update:', rpcGoalErr.message);
    const { data: updatedGoalRows, error: directGoalErr } = await supabase
      .from('savings_goals')
      .update({ current_amount: currentGoalAmount + actual })
      .eq('id', goalId)
      .eq('student_id', targetStudentId)
      .select('id');
    goalErr = directGoalErr;
    if (!directGoalErr && (!updatedGoalRows || updatedGoalRows.length === 0)) {
      console.error('coContribute: goal update matched 0 rows — run supabase_guardian_goals_rls.sql in Supabase SQL Editor');
      goalErr = new Error('0 rows updated');
    }
  } else if (rpcGoalResult === false) {
    console.error('coContribute: guardian_update_goal_amount RPC returned false — not linked to student?');
    goalErr = new Error('RPC returned false');
  }

  if (goalErr) {
    console.error('coContribute: goal update failed', goalErr);
    // Leave the money in student wallet rather than losing it
    // The student can manually contribute from their wallet if needed
    await supabase.from('transactions').insert({
      type: 'allowance',
      amount: actual,
      description: `Guardian bonus (goal update failed — added to wallet): ${goalName}`,
      category: 'savings',
      from_user_id: guardianId,
      to_user_id: targetStudentId,
      created_at: new Date().toISOString(),
    });
    return false;
  }

  // 4. Deduct the credited amount back out of student wallet now that it's in the goal
  await supabase
    .from('wallets')
    .upsert({ user_id: targetStudentId, balance: studentBalance }, { onConflict: 'user_id' });

  // 5. Record transaction
  await supabase.from('transactions').insert({
    type: 'allowance',
    amount: actual,
    description: `Guardian bonus toward: ${goalName}`,
    category: 'savings',
    from_user_id: guardianId,
    to_user_id: targetStudentId,
    created_at: new Date().toISOString(),
  });

  return true;
}

/** Student redeems a completed (or partial) goal back to their wallet */
export async function redeemGoal(
  goalId: string,
  amountToRedeem: number,
  goalName: string,
  studentId?: string,
): Promise<boolean> {
  const user = await getLoggedInUser();
  if (!user) return false;

  const rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!rawStudentId) return false;
  const targetStudentId = await resolveProfileId(rawStudentId) ?? rawStudentId;

  // Get current goal state
  const { data: goalData } = await supabase
    .from('savings_goals')
    .select('current_amount, is_locked')
    .eq('id', goalId)
    .maybeSingle();
  if (!goalData) return false;
  if (goalData.is_locked) return false; // cannot redeem a locked goal

  const actual = Math.min(amountToRedeem, parseFloat(goalData.current_amount.toString()));
  if (actual <= 0) return false;

  // Add back to student wallet
  const { data: walletRows } = await supabase.rpc('get_or_create_wallet', { p_user_id: targetStudentId });
  const currentBalance: number = walletRows?.[0]?.balance ?? 0;
  const { error: walletErr } = await supabase
    .from('wallets')
    .update({ balance: currentBalance + actual, updated_at: new Date().toISOString() })
    .eq('user_id', targetStudentId);
  if (walletErr) { console.error('Error updating student wallet on redeem:', walletErr); return false; }

  // Reduce goal amount
  const newGoalAmount = parseFloat(goalData.current_amount.toString()) - actual;
  if (newGoalAmount <= 0) {
    // Delete goal if fully redeemed
    await supabase.from('savings_goals').delete().eq('id', goalId);
  } else {
    await supabase.from('savings_goals').update({ current_amount: newGoalAmount }).eq('id', goalId);
  }

  // Record transaction
  await supabase.from('transactions').insert({
    type: 'deposit',
    amount: actual,
    description: `Redeemed from goal: ${goalName}`,
    category: 'savings',
    from_user_id: targetStudentId,
    to_user_id: null,
    created_at: new Date().toISOString(),
  });

  return true;
}

// FIX #8: Changed .single() → .maybeSingle() to prevent PGRST116 crashes
export async function getSpendingLimit(studentId?: string): Promise<SpendingLimit | null> {
  const user = await getLoggedInUser();
  if (!user) return null;

  const rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!rawStudentId) return null;

  // Resolve actual users table UUID
  const targetStudentId = await resolveProfileId(rawStudentId) ?? rawStudentId;

  const { data, error } = await supabase
    .from('spending_limits')
    .select('*')
    .eq('student_id', targetStudentId)
    .maybeSingle(); // FIX: was .single() — crashes if no row exists

  if (error) {
    console.error('Error fetching spending limit:', error);
    return null;
  }

  if (!data) return null;

  return {
    dailyLimit: parseFloat(data.daily_limit.toString()),
    isActive: data.is_active,
  };
}

export async function setSpendingLimit(limit: SpendingLimit, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  let rawStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!rawStudentId) return;

  // Resolve auth UUID → actual users table PK (same as getAllowanceConfig / setAllowanceConfig)
  const resolvedStudentId = await resolveProfileId(rawStudentId) ?? rawStudentId;

  const { error } = await supabase
    .from('spending_limits')
    .upsert({
      student_id: resolvedStudentId,
      daily_limit: limit.dailyLimit,
      is_active: limit.isActive,
    }, {
      onConflict: 'student_id'
    });

  if (error) {
    console.error('Error setting spending limit:', error);
  }
}

export function getTodaySpent(transactions: Transaction[]): number {
  const today = new Date().toISOString().split('T')[0];
  return transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(today))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getWeeklySpentByCategory(transactions: Transaction[]): Record<string, number> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense' && new Date(t.date) >= weekAgo && t.category !== 'savings')
    .forEach(t => {
      const cat = t.category || 'other';
      result[cat] = (result[cat] || 0) + t.amount;
    });
  return result;
}

export async function getLastAllowanceDate(studentId?: string): Promise<string | null> {
  const user = await getLoggedInUser();
  if (!user) return null;

  let guardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  let targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!guardianId || !targetStudentId) return null;

  const { data } = await supabase
    .from('allowance_configs')
    .select('last_allowance_date')
    .eq('guardian_id', guardianId)
    .eq('student_id', targetStudentId)
    .maybeSingle();

  return data?.last_allowance_date || null;
}

export async function setLastAllowanceDate(date: string, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  let guardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  let targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!guardianId || !targetStudentId) return;

  await supabase
    .from('allowance_configs')
    .update({ last_allowance_date: date })
    .eq('guardian_id', guardianId)
    .eq('student_id', targetStudentId);
}

export async function processAllowance(studentId?: string): Promise<boolean> {
  const config = await getAllowanceConfig();
  if (!config || !config.isActive) return false;

  const lastDate = await getLastAllowanceDate(studentId);
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (lastDate === today) return false;

  let shouldSend = false;
  if (!lastDate) {
    shouldSend = true;
  } else {
    const last = new Date(lastDate);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    switch (config.frequency) {
      case 'daily': shouldSend = diffDays >= 1; break;
      case 'weekly': shouldSend = diffDays >= 7; break;
      case 'biweekly': shouldSend = diffDays >= 14; break;
      case 'monthly': shouldSend = diffDays >= 30; break;
    }
  }

  if (!shouldSend) return false;

  const guardianBalance = await getGuardianWallet();
  if (guardianBalance < config.amount) return false;

  // Fetch fresh balances from DB — never use cached values
  const freshGuardianBalance = await getGuardianWallet();
  const freshStudentBalance = await getStudentWallet(studentId);

  await setGuardianWallet(freshGuardianBalance - config.amount);
  await setStudentWallet(freshStudentBalance + config.amount, studentId);

  await addTransaction({
    type: 'allowance',
    amount: config.amount,
    description: `${config.frequency.charAt(0).toUpperCase() + config.frequency.slice(1)} allowance`,
    date: now.toISOString(),
    from: 'guardian',
    to: 'student',
  }, studentId);

  await setLastAllowanceDate(today, studentId);
  return true;
}

export async function clearAllData(): Promise<void> {
  const keys = Object.values(KEYS);
  await AsyncStorage.multiRemove(keys);
}

export function generateId(): string {
  // Generate a proper UUID v4 compatible with Supabase
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}