# Android, Google sign-in & Google Play guide

Same codebase as iOS. Everything below is account setup; no code changes needed.
Order matters: **A → B → C → D** (Google sign-in needs the Android signing key's SHA-1, which exists after the first Android build).

## A. Google sign-in — OAuth clients (Google Cloud, ~15 min)

1. [console.cloud.google.com](https://console.cloud.google.com) → create project **BookDate**.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform): External · app name **BookDate** · support email `amitdas+bookdatesupport@gmail.com` · privacy policy `https://amitd01.github.io/bookdate/privacy/`. Scopes: only the defaults (`email`, `profile`, `openid`) — no Google verification needed for these. **Publish** the app (move out of "Testing") so any Google account can sign in.
3. **Credentials → Create credentials → OAuth client ID**, three times:

   | Type | Settings | Used by |
   |---|---|---|
   | **Web application** | Name "BookDate Supabase" | Supabase + the app (`webClientId`) |
   | **iOS** | Bundle ID `com.amitdas.bookdate` | iPhone app |
   | **Android** | Package `com.amitdas.bookdate` + **SHA-1** (step C3) | Android app (no ID needed in code) |

4. Supabase → **Authentication → Sign In / Providers → Google**: enable · **Client IDs** = `<web id>,<ios id>,<android id>` (comma-separated, web first) · **Client Secret** = the Web client's secret · turn on **Skip nonce checks** · Save.
5. Tell the app the IDs (EAS env vars, all environments):
   ```bash
   npx eas-cli@latest env:set --environment production --environment preview --environment development --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value <web client id> --visibility plaintext
   npx eas-cli@latest env:set --environment production --environment preview --environment development --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <ios client id> --visibility plaintext
   ```
   The Google button only appears in builds made after this. On iOS it also needs a new build (`npm run build:ios`).

## B. Android push notifications — Firebase (~10 min)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → pick the existing Google Cloud project **BookDate**.
2. **Add app → Android** → package `com.amitdas.bookdate` → download **`google-services.json`** into the repo folder (it's git-ignored), then:
   ```bash
   npx eas-cli@latest env:create --environment production --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret
   ```
3. Firebase → **Project settings → Service accounts → Generate new private key** (JSON). Then
   `npx eas-cli@latest credentials -p android` → *production* → **Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1)** → upload that JSON.

Without B the app works fine — Android users just don't get push notifications.

## C. Build

1. **Quick test build (APK, sideload on any Android phone):**
   ```bash
   npm run build:android:apk
   ```
   EAS asks to **generate a new Android Keystore → Yes**. When done it prints a link/QR code — open it on an Android phone to install. Share the link with testers.
2. **Store build (AAB for Google Play):** `npm run build:android`
3. **SHA-1 for Google sign-in:** `npx eas-cli@latest credentials -p android` → shows the keystore's **SHA-1 fingerprint** → paste it into the Android OAuth client (A3). Apps installed from Google Play are re-signed by Google, so later also add the **App signing key SHA-1** from Play Console → *Test and release → App integrity* as a second Android OAuth client.

## D. Google Play Console

1. [play.google.com/console](https://play.google.com/console) — one-time **$25** developer registration + identity verification.
2. **Create app**: name *BookDate – Date by the Book* · App · Free · declarations.
3. **Set up your app** checklist:
   - **Privacy policy:** `https://amitd01.github.io/bookdate/privacy/`
   - **App access:** "All or some functionality is restricted" → demo login `reviewer@bookdate.app` / your demo password
   - **Ads:** No
   - **Content rating:** questionnaire → category *Social/Communication*; users interact, share location (approximate) → expect **Mature 17+ / 18+**
   - **Target audience:** **18 and over** only
   - **Data safety:** collected — email, name, approximate location, gender/preferences ("other personal info"), messages (in-app messages), user IDs, app interactions (if PostHog on); encrypted in transit; **users can request deletion**; not shared/sold
   - **Account deletion URL:** `https://amitd01.github.io/bookdate/delete-account/`
   - **App category:** Dating · contact email `amitdas+bookdatesupport@gmail.com` · website `https://amitd01.github.io/bookdate/`
4. **Store listing:** reuse the copy in `docs/APP_STORE.md` §8. Graphics: 512×512 icon (`assets/images/icon.png` resized), 1024×500 feature graphic, ≥2 phone screenshots.
5. **First upload is manual:** *Test and release → Testing → Internal testing → Create release* → upload the `.aab` from step C2 (download from the EAS build page). After that, `npm run submit:android` works once you add a Play **service account** JSON as `./google-play-service-account.json` ([Expo guide](https://expo.fyi/creating-google-service-account)).
6. **New personal developer accounts:** Google requires a **closed test with at least 12 testers opted in for 14 consecutive days** before you can apply for production. Start the closed test early.
