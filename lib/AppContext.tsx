import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  addSavingsGoal: (name: string, target: number, iconName: string) => Promise<void>;
  contributeToGoal: (goalId: string, amount: number) => Promise<void>;
  deleteSavingsGoal: (goalId: string) => Promise<void>;
  refreshData: (studentId?: string) => Promise<void>;
  switchRole: () => Promise<void>;
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
        if (event === 'SIGNED_OUT') {
          await removePushToken();
          await Storage.setLoggedInUser(null);
          setLoggedInUserState(null);
          setRole(null);
          setIsLinked(false);
          setLinkedStudents([]);
          setSelectedStudentId(null);
          selectedStudentIdRef.current = null;
          setNeedsOTP(false);
          setIsLoading(false);
          return;
        }

        const hasValidSession = !!session?.user;
        if (hasValidSession || event !== 'INITIAL_SESSION') {
          console.log('[AppContext] onAuthStateChange:', event, 'hasValidSession:', hasValidSession);
        }

        let user = await Storage.getLoggedInUser();
        console.log('[AppContext] getLoggedInUser result:', user ? `id=${user.id} role=${user.role} isLinked=${user.isLinked}` : 'NULL');

        if (!user && hasValidSession && session?.user) {
          console.log('[AppContext] AsyncStorage empty but session valid — rebuilding user from session');
          const rebuilt = await Storage.signInFromSession(session.user);
          if (rebuilt) {
            user = rebuilt;
            console.log('[AppContext] rebuilt user:', user.id, 'role:', user.role);
          }
        }

        if (user && hasValidSession) {
          const freshUser = await Storage.refreshUserLinkStatus(user);
          setLoggedInUserState(freshUser);
          setRole(freshUser.role);
          setIsLinked(freshUser.isLinked || (freshUser.linkedUserIds?.length ?? 0) > 0);

          const otpRequired = await shouldRequireOTP();
          setNeedsOTP(otpRequired);
          if (!otpRequired) {
            await updateLastActive();
          }

          // Register push notifications after login
          await registerForPushNotifications();

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
        setIsLoading(false);
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
    await removePushToken();
    await Storage.signOut();
    setLoggedInUserState(null);
    setRole(null);
    setLinkedStudents([]);
    setSelectedStudentId(null);
    selectedStudentIdRef.current = null;
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
    await Storage.setGuardianWallet(guardianBalance - amount);
    await Storage.setStudentWallet(studentBalance + amount, targetId);
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
  }, [guardianBalance, studentBalance, loggedInUser, refreshData]);

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
    await Storage.setStudentWallet(studentBalance - amount);
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

  const addSavingsGoal = useCallback(async (name: string, target: number, iconName: string) => {
    const newGoal: SavingsGoal = {
      id: Storage.generateId(),
      name,
      targetAmount: target,
      currentAmount: 0,
      iconName,
      createdAt: new Date().toISOString(),
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
    if (goal && goal.currentAmount > 0) {
      await Storage.setStudentWallet(studentBalance + goal.currentAmount);
    }
    await Storage.deleteSavingsGoalById(goalId);
    await refreshData(selectedStudentIdRef.current ?? undefined);
  }, [studentBalance, savingsGoals, refreshData]);

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
    refreshData,
    switchRole,
  }), [
    role, isLoading, needsOTP, isLinked, loggedInUser,
    guardianBalance, studentBalance, allowanceConfig, spendingLimit,
    transactions, savingsGoals, todaySpent, linkedStudents, selectedStudentId,
    selectStudent, logoutUser, setUserRole, depositToGuardian, sendAllowanceNow,
    updateAllowanceConfig, updateSpendingLimit, addExpense, cashoutStudent,
    addSavingsGoal, contributeToGoal, deleteSavingsGoal, refreshData, switchRole,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}