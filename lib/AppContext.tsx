import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import * as Storage from './storage';
import { supabase } from './supabase';
import type { UserRole, AllowanceConfig, Transaction, SavingsGoal, LoggedInUser, SpendingLimit } from './storage';
import { shouldRequireOTP, updateLastActive } from '../app/otp-verify';
import {
  registerForPushNotifications,
  removePushToken,
  notifyAllowanceReceived,
  notifyStudentSpent,
  notifyDepositSuccess,
  notifySpendingLimitWarning,
  notifyLowGuardianBalance,
  notifyGoalBonus,
  notifyGoalRedeemed,
} from './notifications';

// Low balance threshold — notify guardian when wallet drops below this
const LOW_BALANCE_THRESHOLD = 100;

interface AppContextValue {
  role: UserRole;
  isLoading: boolean;
  needsOTP: boolean;
  isLinked: boolean;
  loggedInUser: LoggedInUser | null;
  guardianBalance: number;
  studentBalance: number;
  allowanceConfig: AllowanceConfig | null;
  spendingLimit: SpendingLimit | null;
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  todaySpent: number;
  linkedStudents: LoggedInUser[];
  selectedStudentId: string | null;
  selectStudent: (studentId: string) => void;
  setLoggedInUser: (user: LoggedInUser | null) => void;
  logoutUser: () => Promise<void>;
  setUserRole: (role: UserRole) => Promise<void>;
  depositToGuardian: (amount: number, description?: string) => Promise<void>;
  sendAllowanceNow: (amount: number, studentId?: string) => Promise<void>;
  updateAllowanceConfig: (config: AllowanceConfig, studentId?: string) => Promise<void>;
  updateSpendingLimit: (limit: SpendingLimit, studentId?: string) => Promise<void>;
  addExpense: (amount: number, description: string, category: string) => Promise<boolean>;
  cashoutStudent: (amount: number, method: string, accountName: string, accountNumber: string) => Promise<void>;
  addSavingsGoal: (name: string, target: number, iconName: string, deadline?: string | null) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number) => Promise<void>;
  deleteSavingsGoal: (goalId: string) => Promise<void>;
  redeemGoal: (goalId: string, amount: number) => Promise<boolean>;
  lockGoal: (goalId: string) => Promise<void>;
  unlockGoal: (goalId: string) => Promise<void>;
  coContributeToGoal: (goalId: string, amount: number, studentId?: string) => Promise<boolean>;
  refreshData: (studentId?: string) => Promise<void>;
  switchRole: () => Promise<void>;
  removeStudent: (studentId: string) => Promise<{ success: boolean; error?: string }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const existingContext = useContext(AppContext);
  if (existingContext !== null) {
    return <>{children}</>;
  }
  return <AppProviderInner>{children}</AppProviderInner>;
}

function AppProviderInner({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOTP, setNeedsOTP] = useState(false);
  const [loggedInUser, setLoggedInUserState] = useState<LoggedInUser | null>(null);
  const [guardianBalance, setGuardianBalance] = useState(0);
  const [studentBalance, setStudentBalance] = useState(0);
  const [allowanceConfig, setAllowanceConfigState] = useState<AllowanceConfig | null>(null);
  const [spendingLimit, setSpendingLimitState] = useState<SpendingLimit | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsGoals, setSavingsGoalsState] = useState<SavingsGoal[]>([]);
  const [isLinked, setIsLinked] = useState(false);
  const [linkedStudents, setLinkedStudents] = useState<LoggedInUser[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectedStudentIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedStudentIdRef.current = selectedStudentId;
  }, [selectedStudentId]);

  // Prevents concurrent executions of the onAuthStateChange handler.
  // Without this, a SIGNED_IN event can start processing while a SIGNED_OUT
  // handler is still awaiting (e.g. removePushToken), causing race conditions.
  const authHandlerLockRef = useRef(false);
  // Tracks the session user ID that was last fully loaded so we can skip
  // redundant SIGNED_IN events for the same user (e.g. triggered by Supabase
  // token operations or push notification upserts).
  const lastLoadedSessionIdRef = useRef<string | null>(null);

  const todaySpent = useMemo(() => Storage.getTodaySpent(transactions), [transactions]);

  const refreshData = useCallback(async (studentId?: string) => {
    const targetId = studentId ?? selectedStudentIdRef.current ?? undefined;
    const [gb, sb, ac, txs, goals, sl] = await Promise.all([
      Storage.getGuardianWallet(),
      Storage.getStudentWallet(targetId),
      Storage.getAllowanceConfig(targetId),
      Storage.getTransactions(targetId),
      Storage.getSavingsGoals(targetId),
      Storage.getSpendingLimit(targetId),
    ]);
    setGuardianBalance(gb);
    setStudentBalance(sb);
    setAllowanceConfigState(ac);
    setTransactions(txs);
    setSavingsGoalsState(goals);
    setSpendingLimitState(sl);
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      refreshData(selectedStudentId);
    }
  }, [selectedStudentId, refreshData]);

  const selectStudent = useCallback((studentId: string) => {
    setSelectedStudentId(studentId);
    selectedStudentIdRef.current = studentId;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const hasValidSession = !!session?.user;
        const sessionUserId = session?.user?.id ?? null;

        console.log('[AppContext] onAuthStateChange:', event, 'userId:', sessionUserId ?? 'none');

        // ── SIGNED_OUT: clear state and navigate to login ─────────────────
        // Note: removePushToken() is done in logoutUser() BEFORE signOut() is
        // called, so we don't need to do it here (and doing it here caused a
        // race because getExpoPushTokenAsync is slow and the next SIGNED_IN
        // would start before this finished).
        if (event === 'SIGNED_OUT') {
          authHandlerLockRef.current = false;
          lastLoadedSessionIdRef.current = null;
          await Storage.setLoggedInUser(null);
          setLoggedInUserState(null);
          setRole(null);
          setIsLinked(false);
          setLinkedStudents([]);
          setSelectedStudentId(null);
          selectedStudentIdRef.current = null;
          setNeedsOTP(false);
          setIsLoading(false);
          router.replace('/login');
          return;
        }

        // ── TOKEN_REFRESHED: no work needed ──────────────────────────────
        if (event === 'TOKEN_REFRESHED') {
          setIsLoading(false);
          return;
        }

        // ── Deduplicate: skip if this SIGNED_IN is for the same session ──
        // registerForPushNotifications() writes to Supabase which can
        // trigger a second SIGNED_IN for the same user — skip it.
        if (event === 'SIGNED_IN' && sessionUserId && sessionUserId === lastLoadedSessionIdRef.current) {
          console.log('[AppContext] Skipping duplicate SIGNED_IN for already-loaded user');
          setIsLoading(false);
          return;
        }

        // ── Serialize: only one handler runs at a time ───────────────────
        // If the previous handler is still running (e.g. SIGNED_OUT is still
        // awaiting removePushToken), wait for it to finish before proceeding.
        if (authHandlerLockRef.current) {
          console.log('[AppContext] Handler already running — queuing', event);
          // Poll until the lock is free (max 8 seconds)
          const start = Date.now();
          while (authHandlerLockRef.current && Date.now() - start < 8000) {
            await new Promise(r => setTimeout(r, 100));
          }
          // After waiting, re-check if this event is still relevant
          if (event === 'SIGNED_IN' && sessionUserId && sessionUserId === lastLoadedSessionIdRef.current) {
            console.log('[AppContext] After wait: already loaded, skipping', event);
            setIsLoading(false);
            return;
          }
        }

        authHandlerLockRef.current = true;

        // ── Wrap everything in try/finally so isLoading ALWAYS clears ────
        try {
          let user = await Storage.getLoggedInUser();
          console.log('[AppContext] getLoggedInUser result:', user ? `id=${user.id} role=${user.role}` : 'NULL');

          // If the cached user is for a DIFFERENT account than the new session,
          // wipe all in-memory state before rebuilding. This stops the previous
          // account's data leaking into the new login.
          if (user && hasValidSession && sessionUserId && user.id !== sessionUserId) {
            console.log('[AppContext] Account switch detected — clearing old state');
            setGuardianBalance(0);
            setStudentBalance(0);
            setAllowanceConfigState(null);
            setTransactions([]);
            setSavingsGoalsState([]);
            setSpendingLimitState(null);
            setLinkedStudents([]);
            setSelectedStudentId(null);
            selectedStudentIdRef.current = null;
            lastLoadedSessionIdRef.current = null;
            await Storage.setLoggedInUser(null);
            user = null;
          }

          // Rebuild from session if AsyncStorage is empty but Supabase has a session
          if (!user && hasValidSession && session?.user) {
            console.log('[AppContext] Rebuilding user from session');
            const rebuilt = await Storage.signInFromSession(session.user);
            if (rebuilt) {
              user = rebuilt;
              console.log('[AppContext] Rebuilt:', user.id, 'role:', user.role);
            }
          }

          if (user && hasValidSession) {
            const freshUser = await Storage.refreshUserLinkStatus(user);
            setLoggedInUserState(freshUser);
            setRole(freshUser.role);
            setIsLinked(freshUser.isLinked || (freshUser.linkedUserIds?.length ?? 0) > 0);

            const otpRequired = await shouldRequireOTP();
            setNeedsOTP(otpRequired);
            if (!otpRequired) await updateLastActive();

            // Mark this session as fully loaded BEFORE registerForPushNotifications
            // so the SIGNED_IN it may trigger gets deduped above.
            lastLoadedSessionIdRef.current = sessionUserId;

            // Fire-and-forget push registration — do NOT await it inside the
            // handler because the Supabase upsert it does can trigger another
            // SIGNED_IN event (which we now skip via lastLoadedSessionIdRef).
            registerForPushNotifications().catch(() => {});

            if (freshUser.role === 'guardian') {
              const students = await Storage.getLinkedStudents();
              setLinkedStudents(students);
              if (students.length > 0 && !selectedStudentIdRef.current) {
                const firstId = students[0].id;
                setSelectedStudentId(firstId);
                selectedStudentIdRef.current = firstId;
                await refreshData(firstId);
              } else {
                await refreshData(selectedStudentIdRef.current ?? undefined);
              }
            } else {
              await refreshData();
            }

            await Storage.processAllowance();
            await refreshData(selectedStudentIdRef.current ?? undefined);
          } else if (event !== 'INITIAL_SESSION' || !hasValidSession) {
            await Storage.setLoggedInUser(null);
            setLoggedInUserState(null);
            setRole(null);
            setIsLinked(false);
            setNeedsOTP(false);
          }
        } catch (err) {
          console.error('[AppContext] onAuthStateChange error:', err);
        } finally {
          authHandlerLockRef.current = false;
          setIsLoading(false);
        }
      }
    );
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (loggedInUser?.role === 'guardian') {
      Storage.getLinkedStudents().then(students => {
        setLinkedStudents(students);
        if (students.length > 0 && !selectedStudentIdRef.current) {
          const firstId = students[0].id;
          setSelectedStudentId(firstId);
          selectedStudentIdRef.current = firstId;
        }
      });
    }
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) return;
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, () => {
        refreshData(selectedStudentIdRef.current ?? undefined);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
        refreshData(selectedStudentIdRef.current ?? undefined);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loggedInUser, refreshData]);

  const logoutUser = useCallback(async () => {
    // 1. Remove push token FIRST, while the session is still valid.
    //    We must do this before signOut() because after SIGNED_OUT fires
    //    the session is gone and the Supabase delete would fail with RLS.
    //    Also set the lastLoaded ref to null so the upcoming SIGNED_OUT
    //    handler doesn't treat it as a duplicate.
    lastLoadedSessionIdRef.current = null;
    try { await removePushToken(); } catch { /* ignore */ }

    // 2. Clear all local state immediately so the UI reacts right away.
    setLoggedInUserState(null);
    setRole(null);
    setIsLinked(false);
    setLinkedStudents([]);
    setSelectedStudentId(null);
    selectedStudentIdRef.current = null;
    setNeedsOTP(false);

    // 3. Navigate to login immediately — don't wait for the SIGNED_OUT event.
    router.replace('/login');

    // 4. Sign out of Supabase in the background. The SIGNED_OUT event will
    //    fire but our handler is a no-op (state already cleared above).
    try { await Storage.signOut(); } catch { /* ignore */ }
  }, []);

  const setUserRole = useCallback(async (newRole: UserRole) => {
    await Storage.setRole(newRole);
    setRole(newRole);
  }, []);

  const depositToGuardian = useCallback(async (amount: number, description?: string) => {
    const newBalance = await Storage.depositToGuardianWallet(amount);
    await Storage.addTransaction({
      type: 'deposit',
      amount,
      description: description || 'Wallet deposit',
      date: new Date().toISOString(),
      from: 'guardian',
    });

    // Notify guardian of successful deposit
    if (loggedInUser) {
      await notifyDepositSuccess(loggedInUser.id, amount, newBalance);
    }

    await refreshData(selectedStudentIdRef.current ?? undefined);
  }, [loggedInUser, refreshData]);

  const sendAllowanceNow = useCallback(async (amount: number, studentId?: string) => {
    const targetId = studentId ?? selectedStudentIdRef.current ?? undefined;
    if (guardianBalance < amount) return;

    // Fetch fresh student balance from DB — never trust cached value
    const freshStudentBalance = await Storage.getStudentWallet(targetId);

    await Storage.setGuardianWallet(guardianBalance - amount);
    await Storage.setStudentWallet(freshStudentBalance + amount, targetId);
    await Storage.addTransaction({
      type: 'allowance',
      amount,
      description: 'Instant allowance',
      date: new Date().toISOString(),
      from: 'guardian',
      to: 'student',
    }, targetId);

    // Notify student that they received allowance
    if (targetId && loggedInUser) {
      await notifyAllowanceReceived(targetId, amount, loggedInUser.displayName);
    }

    // Warn guardian if balance is getting low after sending
    const newGuardianBalance = guardianBalance - amount;
    if (loggedInUser && newGuardianBalance < LOW_BALANCE_THRESHOLD && newGuardianBalance >= 0) {
      await notifyLowGuardianBalance(loggedInUser.id, newGuardianBalance);
    }

    await refreshData(targetId);
  }, [guardianBalance, loggedInUser, refreshData]);

  const updateAllowanceConfig = useCallback(async (config: AllowanceConfig, studentId?: string) => {
    const targetId = studentId ?? selectedStudentIdRef.current ?? undefined;
    await Storage.setAllowanceConfig(config, targetId);
  }, []);

  const updateSpendingLimit = useCallback(async (limit: SpendingLimit, studentId?: string) => {
    const targetId = studentId ?? selectedStudentIdRef.current ?? undefined;
    await Storage.setSpendingLimit(limit, targetId);
  }, []);

  const addExpense = useCallback(async (amount: number, description: string, category: string): Promise<boolean> => {
    if (studentBalance < amount) return false;
    if (spendingLimit && spendingLimit.isActive) {
      const currentTodaySpent = Storage.getTodaySpent(transactions);
      if (currentTodaySpent + amount > spendingLimit.dailyLimit) return false;
    }

    // Fetch fresh balance from DB before deducting
    // Must pass the student's own ID so the correct wallet is read.
    // Without it, getStudentWallet() falls back to linkedUserIds[0] which
    // may resolve to a different user (or return 0), causing the balance to
    // appear to reset after a guardian deposit.
    const studentOwnId = loggedInUser?.id;
    const freshStudentBalance = await Storage.getStudentWallet(studentOwnId);
    if (freshStudentBalance < amount) return false;

    await Storage.setStudentWallet(freshStudentBalance - amount, studentOwnId);
    await Storage.addTransaction({
      type: 'expense',
      amount,
      description,
      category,
      date: new Date().toISOString(),
      from: 'student',
    });

    // Notify guardian that student spent money
    if (loggedInUser && loggedInUser.linkedUserIds?.length > 0) {
      const guardianId = loggedInUser.linkedUserIds[0];
      await notifyStudentSpent(guardianId, amount, loggedInUser.displayName, description);
    }

    // Warn student if they're near spending limit (80% used)
    if (spendingLimit && spendingLimit.isActive && loggedInUser) {
      const newTodaySpent = Storage.getTodaySpent(transactions) + amount;
      const usedPercent = newTodaySpent / spendingLimit.dailyLimit;
      if (usedPercent >= 0.8) {
        await notifySpendingLimitWarning(loggedInUser.id, newTodaySpent, spendingLimit.dailyLimit);
      }
    }

    await refreshData(selectedStudentIdRef.current ?? undefined);
    return true;
  }, [studentBalance, spendingLimit, transactions, loggedInUser, refreshData]);

  const cashoutStudent = useCallback(async (amount: number, method: string, accountName: string, accountNumber: string) => {
    if (studentBalance < amount) throw new Error('Insufficient balance');
    await Storage.setStudentWallet(studentBalance - amount);
    await Storage.addTransaction({
      type: 'expense',
      amount,
      description: `Cash out via ${method} · ${accountName} (${accountNumber})`,
      category: 'cashout',
      date: new Date().toISOString(),
      from: 'student',
    });

    // Notify guardian of cashout
    if (loggedInUser && loggedInUser.linkedUserIds?.length > 0) {
      const guardianId = loggedInUser.linkedUserIds[0];
      await notifyStudentSpent(guardianId, amount, loggedInUser.displayName, `Cash out via ${method}`);
    }

    await refreshData(selectedStudentIdRef.current ?? undefined);
  }, [studentBalance, loggedInUser, refreshData]);

  const addSavingsGoal = useCallback(async (name: string, target: number, iconName: string, deadline?: string | null) => {
    const newGoal: SavingsGoal = {
      id: Storage.generateId(),
      name,
      targetAmount: target,
      currentAmount: 0,
      iconName,
      createdAt: new Date().toISOString(),
      deadline: deadline ?? null,
      isLocked: false,
      lockedBy: null,
    };
    await Storage.insertSavingsGoal(newGoal);
    setSavingsGoalsState(prev => [newGoal, ...prev]);
  }, []);

  const contributeToGoal = useCallback(async (goalId: string, amount: number) => {
    if (studentBalance < amount) return;
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;
    const remaining = goal.targetAmount - goal.currentAmount;
    const actual = Math.min(amount, remaining);
    if (actual <= 0) return;
    await Storage.setStudentWallet(studentBalance - actual);
    await Storage.updateGoalAmount(goalId, goal.currentAmount + actual);
    await Storage.addTransaction({
      type: 'expense',
      amount: actual,
      description: `Saved toward: ${goal.name}`,
      category: 'savings',
      date: new Date().toISOString(),
      from: 'student',
    });
    await refreshData(selectedStudentIdRef.current ?? undefined);
  }, [studentBalance, savingsGoals, refreshData]);

  const deleteSavingsGoal = useCallback(async (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (goal && goal.currentAmount > 0 && !goal.isLocked) {
      await Storage.setStudentWallet(studentBalance + goal.currentAmount);
    }
    await Storage.deleteSavingsGoalById(goalId);
    await refreshData(selectedStudentIdRef.current ?? undefined);
  }, [studentBalance, savingsGoals, refreshData]);

  const redeemGoal = useCallback(async (goalId: string, amount: number): Promise<boolean> => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal || goal.isLocked) return false;
    const success = await Storage.redeemGoal(goalId, amount, goal.name);
    if (success) {
      await refreshData(selectedStudentIdRef.current ?? undefined);
      // Notify guardian that the student redeemed a goal
      try {
        const user = await Storage.getLoggedInUser();
        if (user && user.linkedUserIds?.length) {
          await notifyGoalRedeemed(
            user.linkedUserIds[0],
            user.displayName,
            amount,
            goal.name,
          );
        }
      } catch (e) {
        console.warn('Goal redeem notification failed:', e);
      }
    }
    return success;
  }, [savingsGoals, refreshData]);

  const lockGoal = useCallback(async (goalId: string) => {
    const user = await Storage.getLoggedInUser();
    if (!user) return;
    const success = await Storage.lockSavingsGoal(goalId, user.displayName);
    if (success) {
      await refreshData(selectedStudentIdRef.current ?? undefined);
    } else {
      const { Alert } = await import('react-native');
      Alert.alert('Lock Failed', 'Could not lock the goal. Please try again or check your connection.');
    }
  }, [refreshData]);

  const unlockGoal = useCallback(async (goalId: string) => {
    const success = await Storage.unlockSavingsGoal(goalId);
    if (success) {
      await refreshData(selectedStudentIdRef.current ?? undefined);
    } else {
      const { Alert } = await import('react-native');
      Alert.alert('Unlock Failed', 'Could not unlock the goal. Please try again or check your connection.');
    }
  }, [refreshData]);

  const coContributeToGoal = useCallback(async (goalId: string, amount: number, studentId?: string): Promise<boolean> => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return false;
    const targetStudentId = studentId ?? selectedStudentIdRef.current ?? undefined;
    const success = await Storage.coContributeToGoal(goalId, amount, goal.name, targetStudentId);
    if (success) {
      await refreshData(selectedStudentIdRef.current ?? undefined);
      if (targetStudentId && loggedInUser) {
        await notifyGoalBonus(targetStudentId, amount, loggedInUser.displayName, goal.name);
      }
    }
    return success;
  }, [savingsGoals, refreshData, loggedInUser]);

  const removeStudent = useCallback(async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await Storage.unlinkStudent(studentId);
      if (!result.success) return result;

      // Update linkedStudents state
      const updatedStudents = linkedStudents.filter(s => s.id !== studentId);
      setLinkedStudents(updatedStudents);

      // Update selectedStudentId
      if (selectedStudentIdRef.current === studentId) {
        const nextStudent = updatedStudents[0] ?? null;
        setSelectedStudentId(nextStudent?.id ?? null);
        selectedStudentIdRef.current = nextStudent?.id ?? null;
        if (nextStudent) await refreshData(nextStudent.id);
      }

      // Update loggedInUser linkedUserIds
      if (loggedInUser) {
        const updatedLinkedIds = (loggedInUser.linkedUserIds || []).filter(id => id !== studentId);
        const updatedUser = {
          ...loggedInUser,
          linkedUserIds: updatedLinkedIds,
          isLinked: updatedLinkedIds.length > 0,
        };
        await Storage.setLoggedInUser(updatedUser);
        setLoggedInUserState(updatedUser);
        setIsLinked(updatedLinkedIds.length > 0);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, [linkedStudents, loggedInUser, refreshData]);

  const switchRole = useCallback(async () => {
    const newRole = role === 'guardian' ? 'student' : 'guardian';
    await Storage.setRole(newRole);
    setRole(newRole);
    if (loggedInUser) {
      const updatedUser = { ...loggedInUser, role: newRole as 'guardian' | 'student' };
      await Storage.setLoggedInUser(updatedUser);
      setLoggedInUserState(updatedUser);
    }
  }, [role, loggedInUser]);

  const value = useMemo(() => ({
    role,
    isLoading,
    needsOTP,
    isLinked,
    loggedInUser,
    guardianBalance,
    studentBalance,
    allowanceConfig,
    spendingLimit,
    transactions,
    savingsGoals,
    todaySpent,
    linkedStudents,
    selectedStudentId,
    selectStudent,
    setLoggedInUser: (user: LoggedInUser | null) => {
      setLoggedInUserState(user);
      setIsLinked(!!user && (user.isLinked || (user.linkedUserIds?.length ?? 0) > 0));
      if (user?.role) setRole(user.role);
    },
    logoutUser,
    setUserRole,
    depositToGuardian,
    sendAllowanceNow,
    updateAllowanceConfig,
    updateSpendingLimit,
    addExpense,
    cashoutStudent,
    addSavingsGoal,
    contributeToGoal,
    deleteSavingsGoal,
    redeemGoal,
    lockGoal,
    unlockGoal,
    coContributeToGoal,
    refreshData,
    switchRole,
    removeStudent,
  }), [
    role, isLoading, needsOTP, isLinked, loggedInUser,
    guardianBalance, studentBalance, allowanceConfig, spendingLimit,
    transactions, savingsGoals, todaySpent, linkedStudents, selectedStudentId,
    selectStudent, logoutUser, setUserRole, depositToGuardian, sendAllowanceNow,
    updateAllowanceConfig, updateSpendingLimit, addExpense, cashoutStudent,
    addSavingsGoal, contributeToGoal, deleteSavingsGoal, redeemGoal, lockGoal, unlockGoal, coContributeToGoal, refreshData, switchRole, removeStudent,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}