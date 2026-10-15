# Google Play: listing, forms and what is left

App: **Control Your PC**, package `com.kmages.macremote`, developer account "Know Your Tout".
Play Console app id: `4975248703213216062` (developer `6489944621972506535`).

## Done
- App created (free). Internal testing release 0.1.0 (3) published; tester list "Control Your PC testers" (kmages@gmail.com).
- Subscription `controlyourpc_yearly`, base plan `yearly` ACTIVE ($9.99, US only), offer `trial3` (3-day free trial, new customers).
- RevenueCat: product `controlyourpc_yearly:yearly` attached to entitlement `pro` and package `$rc_annual` in offering `default`.
- Assets: `branding/screenshots/play/*.png` (1080x1920), `branding/play-feature-graphic.png` (1024x500), `public/icon-512.png` (app icon 512x512).

## Store listing text
**App name:** Control Your PC
**Short description (80 max):** Remote control for your Mac that keeps you signed in.
**Full description:** use `mobile/store.config.json` (apple.info.en-US.description), changing "Apple ID" to "Google Play account" and "Apple ID settings" to "Play Store subscription settings".
**Category:** Tools. **Tags:** remote desktop, remote control.
**Contact email:** kmages+support@gmail.com. **Website:** https://phonetopcremote.com/ **Privacy policy:** https://phonetopcremote.com/privacy/

## Data safety (proposed answers, confirm before submitting)
- Collects data: Yes. Types: **Financial info > Purchase history** and **Device or other IDs > User ID** (RevenueCat anonymous app user id).
- Purpose: App functionality only. Not used for advertising, analytics or tracking.
- Shared with third parties: No (RevenueCat acts as a service provider processing subscription status on our behalf).
- Encrypted in transit: Yes. Users can request deletion: via kmages+support@gmail.com.
- Nothing else collected (no location, contacts, photos, messages, audio, files).

## Other forms
- Content rating (IARC questionnaire): no violence, sexual content, gambling, user-generated content, location sharing. Expect "Everyone".
- Target audience: 18+ (not for children).
- Ads: No. App access: all functionality needs a subscription, so give reviewers the in-app **demo** ("Try the demo") and the test notes from `docs/APP_REVIEW_NOTES.md`.
- Government apps / financial features / health: No. News: No.

## RevenueCat needs a Google service account (credential, the account owner does this)
1. Google Cloud console: create (or reuse) a service account; the existing KYT one (`kyt-play-publisher@...`) can be reused because Play access is per developer account.
2. Play Console > Users and permissions: invite that service account with **View app information**, **View financial data** and **Manage orders and subscriptions** for Control Your PC.
3. Create a JSON key for it. In RevenueCat > Apps > Control Your PC (Play Store) > Service account credentials, upload the JSON.
4. Enable the Cloud Pub/Sub and Google Play Android Developer APIs; set up real-time developer notifications as RevenueCat's page shows.
5. Wait up to ~36 hours for Google to propagate the permissions, then test a purchase from the internal test build.

## Production release checklist
1. Listing, Data safety, content rating, target audience, ads, app access all complete (Play dashboard shows no open tasks).
2. Test the subscription on an Android phone from the internal track (needs step above).
3. Promote the release to Production (Test and release > Production), add US only.
4. Remember: new Play accounts need a closed test first; this developer account is older and was told it does not.
