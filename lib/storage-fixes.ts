// ==========================================
// FIXES FOR storage.ts
// ==========================================
// Apply these changes to fix the "PGRST116" wallet errors

import { supabase } from './supabase';
import { getLoggedInUser, setLoggedInUser } from './storage';
import type { AllowanceConfig, LoggedInUser } from './storage';

// Replace the getGuardianWallet function (around line 582):
export async function getGuardianWallet(): Promise<number> {
  const user = await getLoggedInUser();
  if (!user) return 0;

  let guardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!guardianId) return 0;

  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', guardianId)
    .maybeSingle(); // Changed from .single() to .maybeSingle()

  if (error) {
    console.error('Error fetching guardian wallet:', error);
    return 0;
  }

  // If no wallet exists, create one
  if (!data) {
    const { error: insertError } = await supabase
      .from('wallets')
      .insert({ user_id: guardianId, balance: 0 });
    
    if (insertError) {
      console.error('Error creating guardian wallet:', insertError);
    }
    return 0;
  }

  return data.balance || 0;
}

// Replace setGuardianWallet (around line 603):
export async function setGuardianWallet(amount: number): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  let guardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!guardianId) return;

  const { error } = await supabase
    .from('wallets')
    .upsert({ // Changed to upsert to handle missing wallets
      user_id: guardianId,
      balance: amount
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error updating guardian wallet:', error);
  }
}

// Replace getStudentWallet (around line 620):
export async function getStudentWallet(studentId?: string): Promise<number> {
  const user = await getLoggedInUser();
  if (!user) return 0;

  const targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!targetStudentId) return 0;

  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', targetStudentId)
    .maybeSingle(); // Changed from .single() to .maybeSingle()

  if (error) {
    console.error('Error fetching student wallet:', error);
    return 0;
  }

  // If no wallet exists, create one
  if (!data) {
    const { error: insertError } = await supabase
      .from('wallets')
      .insert({ user_id: targetStudentId, balance: 0 });
    
    if (insertError) {
      console.error('Error creating student wallet:', insertError);
    }
    return 0;
  }

  return data.balance || 0;
}

// Replace setStudentWallet (around line 638):
export async function setStudentWallet(amount: number, studentId?: string): Promise<void> {
  const user = await getLoggedInUser();
  if (!user) return;

  const targetStudentId = studentId || (user.role === 'student' ? user.id : user.linkedUserIds[0]);
  if (!targetStudentId) return;

  const { error } = await supabase
    .from('wallets')
    .upsert({ // Changed to upsert
      user_id: targetStudentId,
      balance: amount
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error updating student wallet:', error);
  }
}

// Replace getAllowanceConfig (around line 663):
export async function getAllowanceConfig(): Promise<AllowanceConfig | null> {
  const user = await getLoggedInUser();
  if (!user) return null;

  let guardianId = user.role === 'guardian' ? user.id : user.linkedUserIds[0];
  if (!guardianId) return null;

  const { data, error } = await supabase
    .from('allowance_configs')
    .select('*')
    .eq('guardian_id', guardianId)
    .maybeSingle(); // Changed from .single() to .maybeSingle()

  if (error && error.code !== 'PGRST116') {
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
