# Rolenest mobile app

React Native (Expo SDK 57, TypeScript, expo-router) app for the Jobify backend. "Rolenest" is a working
name: change `APP_NAME` in `src/constants/app.ts` (and `name`/`slug` in `app.json`) to rename it.

AI career copilot. Promise: find the right role, prepare a stronger application, approve it, send it.

Principles built into the UI: the user is always in control (nothing is sent, published or deleted
without an explicit approval screen), honest AI (sources shown, unverified items flagged, no invented
experience or salary), every match score is explained, calm copy, real step progress for slow work.

## Run it

```bash
cd mobile
npm install
cp .env.example .env          # then edit EXPO_PUBLIC_API_URL
npx expo start                # press i (iOS simulator), a (Android), or scan with Expo Go
```

Useful checks:

```bash
npx tsc --noEmit              # type check
npx expo-doctor               # dependency / config check
npx expo export --platform ios
```

### Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` (`http://10.0.2.2:8000` on Android) | Backend origin, no trailing slash. The app adds `/api/v1`. |

Real auth (`/api/v1/auth/register|login|refresh|logout`, `/api/v1/users/me`) talks to this URL. On a
physical phone use your computer's LAN address or a deployed URL, not `localhost`.

## What is real and what is mocked

| Area | Status |
| --- | --- |
| Sign up, log in, token storage (Keychain/Keystore via `expo-secure-store`), refresh on 401, log out, current user | **Real**, wired to the backend schemas (`RegisterRequest`, `LoginRequest`, `RefreshRequest`, `TokenPair`, `UserRead`) |
| Cold-start handling (long timeouts, retry on 502/503/504, "Waking up the server" banner) | **Real** (client side) |
| Forgot password | UI only. The backend has no endpoint, so nothing is sent and the screen says so |
| Jobs, matching, CV parsing, application preparation, approvals/sending, applications tracker, usage, assistant, notifications, interview prep, career plan, salary insights | **Mock** repository in `src/api/mock/` behind the typed `Repository` interface (`src/api/repository.ts`). Sample content, in memory, clearly labelled |
| Match scores | The five deterministic factors (location, salary, seniority, employment type, required skills) are real rules over your setup and confirmed CV skills; the three AI factors are simple stand-ins |
| CV upload | The picker (PDF/DOCX, 10 MB limit) is real; the file is **not** read or uploaded. A sample parse result is returned and labelled "Sample content" |
| "Send" / "Publish" | Simulated. The approval flow is complete, but no email or post leaves the device. Use Settings > Sample data tools to simulate a failed send and see the honest "Nothing was sent" state |
| Integrations, push notifications, data export, account deletion on the server | Not connected. Screens exist and say so |

Salary appears only on sample jobs whose (sample) source states one, always with that source text.

## Structure

```
src/
  app/                 expo-router routes (thin files that re-export screens)
    (auth)/            welcome, signup, login, forgot   (signed-out only)
    (onboarding)/      consent, setup, cv-upload, cv-review (signed in, onboarding unfinished)
    (app)/             everything else (signed in + onboarded)
      (tabs)/          home, jobs, applications, assistant, profile (each its own Stack, large titles)
  screens/             screen implementations by feature
  components/
    ui/                Text, Icon, Button, Section/Row (inset-grouped lists), Chip, SegmentedControl, TextField,
                       Screen, TabBar (blurred), HeaderButton, SheetOptions, Feedback (Skeleton, ProgressBar, Card)
    states/            EmptyState, ErrorState, OfflineBanner, ServerWakingUp, UsageLimit, ParsingProblem, Success, skeletons
    domain/            JobCard, MatchBlock, StepRow, Honesty (AiBadge, SourceNote, UnverifiedNote, PermissionBadge)
  theme/               tokens.ts (pure TS, reusable on web), useTheme()
  api/                 client.ts (fetch wrapper), auth.ts (real), types.ts, repository.ts, mock/ (sample data)
  state/               tiny external stores: session, profile, data (offline cache), preferences, filters, cvParser, ...
  i18n/                t() helper + locales/{en,fr,ar}
  lib/                 store, storage, network (NetInfo), haptics, format
  hooks/               useStackOptions, useLoad, useReduceMotion
```

### Design system

* `src/theme/tokens.ts`: iOS system colours (light + dark), Dynamic Type scale
  (Large Title 34/41 down to Caption2 11/13), 4pt spacing, radii. `useTheme()` returns them and follows the
  system scheme (or the override in Settings).
* System font only (SF Pro on iOS). Text scales with the user's font size setting.
* Status colours (green/orange/red) are used only for match levels and pipeline status, always together
  with a text label and an icon.
* Large collapsing titles and blurred bars use the native stack header on iOS; the tab bar and sticky
  footers use `expo-blur`. Android gets a plain Material-ish app bar and surface.
* Sheets (filters, add job, approval) use `presentation: 'formSheet'` with a grabber on iOS.
* Haptics on key actions, reduce-motion respected, 44pt minimum touch targets.

### Offline

`@react-native-community/netinfo` drives an offline banner. Saved jobs, the tracker, drafts, approvals
and match results are cached in AsyncStorage and stay readable offline. Buttons that need the network
(prepare, send, import, regenerate) are disabled with an explanation.

### Languages and RTL

English is complete. French and Arabic cover tabs, common actions, onboarding, auth, consent, setup and
the CV steps (everything else falls back to English). Choosing Arabic flips the layout (all layout uses
start/end); React Native applies the direction at launch, so the app asks you to restart after switching
between left-to-right and right-to-left languages.

## Known gaps

See the final report that accompanied this build; in short: only auth is real, no push notifications,
no real CV parsing, and nothing has been run on a physical device by the author of this build.
