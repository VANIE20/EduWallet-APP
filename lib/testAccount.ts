// ─────────────────────────────────────────────
//  TEST ACCOUNTS  (permanent OTP bypass)
//  Only these two emails get special treatment.
//  Every other account works completely normally.
// ─────────────────────────────────────────────

export const TEST_ACCOUNTS = {
  guardian: {
    email: 'testguardian@eduwallet.com',
    pin:   '123456',
    otp:   '123456',
    role:  'guardian' as const,
  },
  student: {
    email: 'teststudent@eduwallet.com',
    pin:   '123456',
    otp:   '123456',
    role:  'student' as const,
  },
};

export const PERMANENT_OTP = '123456';

const TEST_EMAILS = [
  TEST_ACCOUNTS.guardian.email,
  TEST_ACCOUNTS.student.email,
];

/** Returns true if the email belongs to a test account */
export function isTestAccount(email: string): boolean {
  return TEST_EMAILS.includes(email.toLowerCase().trim());
}

/** Returns the PIN for a test account (used to sign in after OTP bypass) */
export function getTestPin(email: string): string {
  return PERMANENT_OTP;
}