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

# EduWallet Changelog

## v1.6.2 — Smart Scheduling & Automation Upgrade
✨ New
Allowance system now supports exact scheduled send time
Auto-scheduler supports daily, weekly, and biweekly rules with day selection
Allowance history now shows actual send date and day
📈 Improvements
Schedule UI redesigned with clean “Choose a time” picker
Added “Next Auto-Send” preview card showing exact next payout time
Transaction history expanded to 30 days with better date labels (Today, Yesterday, Mon, Tue, etc.)
🛠 Fixes
Fixed auto allowance sending repeatedly after sign-out/sign-in
Fixed allowance processing running from auth state events (duplicate trigger bug)
Fixed test account profile updates not saving when auth session is missing
Added fallback user ID handling for QA/test accounts
Fixed scheduler ignoring day-of-week and send-time configuration

## v1.6.1 — QA Stability & System Fixes Update
✨ New
Test accounts added for QA (pre-linked + permanent OTP support)
Guardian now receives push notification when student hits daily spending limit
📈 Improvements
Test accounts skip OTP email sending (no real emails during testing)
Spending limit notifications split into:
80% warning (student)
100% alert (guardian)
🛠 Fixes
Fixed Guardian dashboard crash caused by missing theme object (G)
Fixed guardian_update_goal_amount RPC always returning false (auth.uid() fix)

## v1.6.0 — 1.6.0 → Feature Update (AI + Profile System)

### ✨ New

* Walli AI Assistant — a built-in AI-powered help chatbot accessible from the Help Center, powered by Claude.
* Walli automatically saves support conversations as tickets in the database so issues are tracked and can be reviewed.
* Help Center screen redesigned with a dedicated chat interface for Walli, replacing the old static FAQ.
* Avatar upload — users can now set a profile photo from their photo library on the Profile screen.
* Avatar is stored in Supabase Storage and persists across sessions and app restarts.

### 📈 Improvements

* Guardian and Student dashboards now show the profile avatar photo in the top-right corner instead of a letter initial.
* Profile screen shows the avatar image with a camera button overlay; tapping it opens the photo picker.

### 🛠 Fixes

* Fixed `"bucket not found"` error on avatar upload — storage bucket and RLS policies corrected.
* Fixed avatar not saving to database — RLS UPDATE policy now matches on `auth_user_id` instead of `id`.
* Fixed avatar disappearing after reload — `loadAvatar` now correctly queries by `auth_user_id`.
* Fixed deprecated `ImagePicker.MediaTypeOptions` — updated to use string array format.

---

## v1.5.0 — May 10, 2026

### ✨ New

* Guardian can now remove a linked student — requires OTP email verification before the unlink is processed.
* After removing all students, guardian is prompted to cash out their wallet balance or invite a new student.
* Student goal deadline replaced with a manual date picker — set any exact date up to 20 years ahead, no more preset week/month buttons.
* Deadline countdown now shows `"X days remaining"` for near dates and `"X months remaining"` for far dates.
* Date picker enforces boundaries: past dates are blocked, maximum is 20 years from today.

### 📈 Improvements

* Linked Students card now shows for single students too, with a remove button next to each name.
* Expense screen now unified — Cash Out removed as a separate tab; all payouts processed through E-Wallet directly from the Expense screen.
* Guardian dashboard redesigned with a maroon color theme.
* Student dashboard redesigned with a warm ember/burnt orange color theme.
* Both dashboards now show up to 7 recent transactions instead of 5.
* Transaction history screens now show a Daily Activity bar chart for the last 7 days.
* Warning badges (low/no balance) now use an icon + text row for a cleaner look.
* Ad banner repositioned to sit between content sections for a more natural flow.

### 🛠 Fixes

* Fixed OTA update error in Expo Go: `checkForUpdateAsync()` now only runs in production builds.
* Ad banner image now fills its container correctly.
* Balance and currency amounts now shrink to fit on one line.
* Scroll content on both dashboards now ends at the last item with no excess blank space below.

---

## v1.4.0 — May 8, 2026

### ✨ New

* Push notifications for allowance, spending, deposits, and spending limits.
* Firebase FCM V1 integrated for reliable Android push delivery.

### 📈 Improvements

* Push token saved to Supabase on login and removed on logout.

### 🛠 Fixes

* Student balance no longer resets after allowance transfers.
* Wallet operations now fetch fresh balance from DB instead of stale cached values.
* Fixed RLS policy blocking push token saves to `push_tokens`.

---

## v1.3.0 — May 7, 2026

### ✨ New

* Guardian can lock a student’s savings goal.
* Guardian can send bonuses directly into savings goals.
* Transaction history now correctly shows student names for multiple students.

### 🛠 Fixes

* Added `toUserId` and `fromUserId` to Transaction type.
* Bonus and lock actions now update goals in real time.
* Removed deprecated Expo notification flag warning.

---

## v1.2.0 — April 28, 2026

### 🛠 Fixes

* Fixed linked-account UUID mismatch issue.
* Fixed link-required screen reappearing after re-login.
* Invite acceptance now falls back to direct insert if RPC fails.
* Removed duplicate `isLinked` useEffect race condition.
* State now clears immediately on `SIGNED_OUT`.
* Fixed dual-UUID lookup in `login.tsx` and `otp-verify.tsx`.
* Fixed `user_links` insert error: `"column status does not exist"`.

---

## v1.1.0 — April 20, 2026

### ✨ New

* Forgot PIN screen with OTP verification.
* Profile editing screen for name, email, phone, and PIN.

### 📈 Improvements

* Guardian dashboard now supports quick-switching between linked students.
* Email changes now require a phone number for verification.

### 🛠 Fixes

* Fixed `setLoggedInUser(null)` TypeScript issue.
* Sign out now uses `logoutUser()` from context.
* OTP gate now properly restores `needsOTP`.

### 🔒 Security

* PayMongo secret key moved to environment variables.

---

## v1.0.1 — April 10, 2026

### 🛠 Fixes

* Fixed Goal Name input binding issue.
* Fixed guardian goals screen navigation route.
* Removed unused Animated/FadeInDown imports.
* Fixed `useRef` type error in deposit screen.
* Fixed React version mismatch causing APK crashes.

---

## v1.0.0 — April 1, 2026

### 🚀 Initial Release

* Guardian wallet with PayMongo deposits and allowance transfers.
* Student wallet with expense tracking.
* Spending limit controls.
* Savings goals with progress tracking.
* Transaction history system.
* Guardian ↔ student linking via invite email.
* 6-digit PIN login with OTP verification.

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
