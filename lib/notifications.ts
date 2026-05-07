import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getLoggedInUser } from './storage';

// ── Configure how notifications appear when app is in foreground ──────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Register device and save push token to Supabase ───────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('[Notifications] Not a physical device — skipping');
      return null;
    }

    console.log('[Notifications] Requesting permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[Notifications] New permission status:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission denied — cannot register');
      return null;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'EduWallet',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9B1C1C',
        sound: 'default',
      });
      console.log('[Notifications] Android channel created');
    }

    console.log('[Notifications] Getting Expo push token...');
    let token: string;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '1c699995-9f97-40ca-9a39-923a0664d727',
      });
      token = tokenData.data;
      console.log('[Notifications] Got token:', token);
    } catch (tokenErr: any) {
      console.error('[Notifications] getExpoPushTokenAsync FAILED:', tokenErr.message);
      console.error('[Notifications] Full error:', JSON.stringify(tokenErr));
      return null;
    }

    // Save token to Supabase
    await savePushToken(token);
    return token;
  } catch (error: any) {
    console.error('[Notifications] registerForPushNotifications error:', error.message);
    console.error('[Notifications] Full error:', JSON.stringify(error));
    return null;
  }
}

// ── Save push token to Supabase push_tokens table ────────────────────────
export async function savePushToken(token: string): Promise<void> {
  try {
    const user = await getLoggedInUser();
    if (!user) return;

    // Resolve actual users table UUID
    const { data: profileById } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const { data: profileByAuthId } = !profileById
      ? await supabase.from('users').select('id').eq('auth_user_id', user.id).maybeSingle()
      : { data: null };

    const userId = profileById?.id ?? profileByAuthId?.id ?? user.id;

    // Upsert so we don't duplicate tokens
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.warn('[Notifications] Failed to save push token:', error.message);
    } else {
      console.log('[Notifications] Push token saved for user:', userId);
    }
  } catch (err: any) {
    console.error('[Notifications] savePushToken error:', err.message);
  }
}

// ── Remove push token on logout ───────────────────────────────────────────
export async function removePushToken(): Promise<void> {
  try {
    const user = await getLoggedInUser();
    if (!user) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '1c699995-9f97-40ca-9a39-923a0664d727',
    }).catch(() => null);

    if (!tokenData) return;

    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', tokenData.data);

    console.log('[Notifications] Push token removed on logout');
  } catch (err: any) {
    console.error('[Notifications] removePushToken error:', err.message);
  }
}

// ── Send push notification via Expo Push API ─────────────────────────────
export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Get recipient's push tokens from Supabase
    const { data: tokenRows, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientUserId);

    if (error || !tokenRows || tokenRows.length === 0) {
      console.log('[Notifications] No push tokens found for user:', recipientUserId);
      return;
    }

    // Send to all registered devices of this user
    const messages = tokenRows.map(row => ({
      to: row.token,
      sound: 'default' as const,
      title,
      body,
      data: data || {},
      badge: 1,
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('[Notifications] Push sent:', JSON.stringify(result));
  } catch (err: any) {
    console.error('[Notifications] sendPushNotification error:', err.message);
  }
}

// ── Notification helpers for specific events ──────────────────────────────

// Called when guardian sends allowance to student
export async function notifyAllowanceReceived(
  studentUserId: string,
  amount: number,
  guardianName: string
): Promise<void> {
  await sendPushNotification(
    studentUserId,
    '💰 Allowance Received!',
    `${guardianName} sent you ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
    { type: 'allowance', amount }
  );
}

// Called when student adds an expense
export async function notifyStudentSpent(
  guardianUserId: string,
  amount: number,
  studentName: string,
  description: string
): Promise<void> {
  await sendPushNotification(
    guardianUserId,
    '🛒 Student Spent Money',
    `${studentName} spent ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} — ${description}`,
    { type: 'expense', amount }
  );
}

// Called when guardian deposits to wallet
export async function notifyDepositSuccess(
  guardianUserId: string,
  amount: number,
  newBalance: number
): Promise<void> {
  await sendPushNotification(
    guardianUserId,
    '✅ Deposit Successful',
    `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} added to your wallet. New balance: ₱${newBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
    { type: 'deposit', amount, newBalance }
  );
}

// Called when student is near spending limit
export async function notifySpendingLimitWarning(
  studentUserId: string,
  todaySpent: number,
  dailyLimit: number
): Promise<void> {
  const remaining = dailyLimit - todaySpent;
  await sendPushNotification(
    studentUserId,
    '⚠️ Spending Limit Warning',
    `You only have ₱${remaining.toLocaleString('en-PH', { minimumFractionDigits: 2 })} left for today`,
    { type: 'spending_limit_warning', remaining }
  );
}

// Called when guardian wallet is low
export async function notifyLowGuardianBalance(
  guardianUserId: string,
  balance: number
): Promise<void> {
  await sendPushNotification(
    guardianUserId,
    '⚠️ Low Wallet Balance',
    `Your wallet balance is low: ₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}. Top up to continue sending allowances.`,
    { type: 'low_balance', balance }
  );
}