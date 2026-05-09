# EduWallet

A mobile app I built for guardians to send allowances to students and help them learn how to manage money. Think of it like a family wallet — the guardian holds the funds, sends allowances on a schedule, and the student gets their own view to track spending and save up for goals.

Built with React Native + Expo, backed by Supabase.

---

## What it does

There are two sides to the app — guardian and student. When you sign up you pick a role, and the guardian sends an invite to link with a student.

**Guardian side:**
- Deposit money into your wallet via PayMongo
- Send allowances manually or set a schedule (daily, weekly, biweekly, monthly)
- Set a daily spending limit so students don't overspend
- See what your student has been spending on
- Lock a student's savings goal so they can't withdraw early
- Drop a bonus directly into one of their goals
- Switch between multiple linked students

**Student side:**
- Receive allowances automatically when the schedule runs
- Log expenses with a category
- Create savings goals — set a target, pick an icon, add a deadline
- Track goal progress and redeem once you hit the target
- Cash out balance when needed

Both sides get push notifications for the important stuff — allowance sent, money spent, deposit success, spending limit warnings, and goal bonuses.

---

## Tech

- React Native + Expo (file-based routing via Expo Router)
- Supabase for auth, database, and real-time data
- Firebase FCM V1 for Android push notifications
- TypeScript throughout
- EAS Build + EAS Update for builds and OTA updates
- AsyncStorage for local caching
- PayMongo for payments
- 6-digit PIN login with OTP email verification

---

## Running it locally

You'll need Node 18+, Expo CLI, and a Supabase project set up.

```bash
git clone https://github.com/your-username/EduWallet.git
cd EduWallet
npm install
npx expo start
```

Then open it in Expo Go or a dev build on your phone.

**Supabase setup** — update `lib/supabase.ts` with your project URL and anon key:

```ts
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
```

You'll also need to add a `google-services.json` for Android push notifications.

---

## Building for distribution

This app uses EAS for builds and OTA updates.

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Build a preview APK for internal testing
eas build --profile preview --platform android

# Push a JS update without rebuilding
eas update --channel preview --message "what changed"
```

The preview profile builds an APK you can install directly without going through the Play Store. After the first build, most code changes can be shipped as OTA updates — no reinstall needed on the user's end.

---

## Project layout

```
app/
  _layout.tsx         root layout, OTA update check runs here
  index.tsx           decides where to send the user on launch
  login.tsx
  signup.tsx
  otp-verify.tsx
  forgot-password.tsx
  guardian/
    index.tsx         main dashboard
    deposit.tsx
    send.tsx
    schedule.tsx
    goals.tsx
    add-goal.tsx
    spending-limit.tsx
    history.tsx
    invite-student.tsx
  student/
    index.tsx         main dashboard
    expense.tsx
    goals.tsx
    add-goal.tsx
    cashout.tsx
    history.tsx
  changelog.tsx       in-app update history (modal)

lib/
  AppContext.tsx      global state — balances, transactions, goals
  storage.ts          all Supabase read/write operations
  notifications.ts    push notification helpers
  supabase.ts         client setup
  utils.ts

components/
  BottomNav.tsx
  DrawerMenu.tsx
  PinLock.tsx
  OnboardingTutorial.tsx
```

---

## Changelog

**v1.4.0** — May 8, 2026 *(Latest)*
- Push notifications — get alerted when allowance is sent, money is spent, deposit succeeds, or spending limit is near
- Firebase FCM V1 integrated for reliable Android push delivery
- Fixed student balance resetting to old value after guardian sends allowance
- All wallet operations (expense, cashout, savings contribution, goal delete) now fetch fresh balance from DB instead of using stale cached value
- Push token saved to Supabase on login and removed on logout
- Fixed RLS policy blocking push token save to push_tokens table

**v1.3.0** — May 7, 2026
- Guardian can now lock a student's savings goal to prevent early withdrawals
- Guardian can send a bonus directly into any of the student's savings goals
- Transaction history now shows the correct student name per allowance (e.g. "Sent to Jhuvanie") — supports multiple students
- Added toUserId and fromUserId to Transaction type so history correctly identifies recipients
- Fixed bonus and lock actions not updating the goal in real time
- Removed deprecated notification flag that was throwing warnings on newer Expo versions

**v1.2.0** — April 28, 2026
- Fixed "not linked" status showing for already-linked accounts due to UUID mismatch between auth UUID and users table UUID
- Fixed link-required screen reappearing after sign out and re-login
- Invite acceptance now falls back to direct insert if RPC fails, and verifies the row was actually saved
- Removed duplicate isLinked useEffect that was racing with onAuthStateChange
- State now clears immediately on SIGNED_OUT to prevent stale isLinked carrying over to next login
- Fixed dual-UUID lookup for link status check in login.tsx and otp-verify.tsx
- Fixed user_links insert failing with "column status does not exist" error

**v1.1.0** — April 20, 2026
- Forgot PIN screen — reset PIN via OTP email verification
- Profile screen — edit name, email, phone, and PIN with OTP verification
- Guardian dashboard now shows all linked students with a quick-switch selector
- Email change now requires a phone number on the account for security
- Fixed setLoggedInUser(null) TypeScript error — type now accepts null
- Sign out now uses logoutUser() from context instead of manual null calls
- Fixed OTP gate (needsOTP) being permanently disabled — now correctly calls setNeedsOTP after session check
- PayMongo secret key moved from hardcoded string to environment variable

**v1.0.1** — April 10, 2026
- Fixed Goal Name input in student add-goal screen bound to wrong state, with inline code comments rendering as visible text
- Fixed guardian goals screen navigating to /student/add-goal instead of /guardian/add-goal
- Removed unused Animated and FadeInDown imports from goals screens
- Fixed useRef type error in deposit screen
- Fixed React version mismatch (19.1.0 vs 19.2.5) causing APK crash — downgraded to match react-native renderer

**v1.0.0** — April 1, 2026
- First release
- Guardian wallet — deposit funds via PayMongo and send allowances instantly or on a schedule
- Student wallet — receive allowances, log expenses by category
- Spending limit — guardian sets a daily cap to help students budget
- Savings goals — students set targets and track progress
- Transaction history for both guardian and student
- Guardian ↔ student linking via invite email
- 6-digit PIN login with OTP email verification

---

## Notes

- The currency is in Philippine Peso (₱) — this was built for local use
- OTA updates only work in preview/production builds, not in Expo Go
- If you're switching from an old build to a new one, uninstall the old APK first to avoid conflicts


# EduWallet-APP

git add . 

git commit -m " V1.4.0 " 

git push origin main 





eas update --channel preview --message "ChangeLog"

eas build -p android --profile preview
