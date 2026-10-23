# Store listing text

## Name
Mail Code Copy

## Summary (≤132 chars)
Catches login codes in your Fastmail inbox and copies them in one click. Not affiliated with Fastmail.

## Description
Tired of switching to your email to find a login code?

Mail Code Copy watches your Fastmail inbox and shows a notification the moment a login or verification code arrives. Click it to copy the code, then paste it into the site you're signing in to.

• Instant – uses Fastmail's live push, no waiting for a refresh
• Private – codes are partly hidden in notifications and the list; everything is processed on your device, nothing is sent anywhere except Fastmail
• Simple setup – a short step-by-step wizard; read-only Fastmail API token
• Fill it for you – one click in the popup fills the code box on the page you're on; optionally, a small "Fill code" button appears next to code boxes
• You choose which folders to watch (Inbox by default)

Requires a Fastmail account. Mail Code Copy is an independent project and is not affiliated with or endorsed by Fastmail.

## Single purpose
Detect login/verification codes in the user's Fastmail mailbox and let them copy the code.

## Permission justifications
- **storage** – keep the user's token, folder choice, and recently detected codes on the device.
- **alarms** – periodic fallback check and to restart the live connection if the browser stopped the background worker.
- **notifications** – tell the user a new code has arrived.
- **clipboardWrite** – copy the code when the user clicks a notification or Copy.
- **offscreen** (Chrome only) – clipboard access from the background, which service workers don't have. Used only when copying.
- **activeTab** + **scripting** – when the user clicks Fill in the popup, fill the login-code box on the current tab only.
- **Optional host permission `<all_urls>`** – only if the user turns on "Offer to fill codes on websites". Lets a content script show a Fill button next to login-code fields. It only inspects input fields and never reads or sends page content; the code stays in the extension until the user clicks Fill. Can be turned off at any time.
- **Host `https://api.fastmail.com/*`** – read the user's mail via Fastmail's JMAP API.

## Data disclosures
- Collects/transmits user data to the developer: **No**
- Handles: authentication information (user-supplied API token, sent only to Fastmail), email content (processed locally)
- Not sold, not used for unrelated purposes, no remote code.

## Screenshots needed
Popup with codes; notification; setup wizard (folder step).
