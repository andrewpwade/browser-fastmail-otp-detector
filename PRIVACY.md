# Privacy Policy – Mail Code Copy

_Last updated: 2026-11-02_

Mail Code Copy finds login and verification codes in your Fastmail inbox and lets you copy them. It is not affiliated with Fastmail.

## What it accesses
- Your **Fastmail API token**, which you provide.
- The **sender, subject and text** of new messages in the folders you choose (your Inbox by default), read only to find a code.

## How it is used
- The token is sent **only to `api.fastmail.com`** to read your mail.
- Messages are processed **on your device**. Nothing is sent to the developer or any third party. There is no analytics, tracking or advertising.

## Filling codes on websites
- The popup's Fill button runs only on the tab you are viewing, when you click it.
- If you turn on "Offer to fill codes on websites", a script runs on pages to find login-code input fields. It does not read, store or transmit page content, and only receives a masked code until you click Fill.
- A code is only offered on, and only handed to, pages of the website that sent it (judged by the sender's domain), so a look-alike phishing site can't get it. The popup's Fill button warns before filling a code into a different site.

- After a fill, the script notes (on your device only) whether you submitted the form and whether the page then moved on, to decide if the code was accepted and should be marked as used. Nothing about this leaves your browser.

## What is stored
- On your device, in the browser's extension storage: your token, your chosen folders and IDs of messages already seen.
- Detected codes, with their sender and subject, are kept **in memory only** (never written to disk) and are discarded after about an hour, or when the browser closes. Web pages and the on-page script cannot read them.
- The extension's storage is not synced to other devices.
- The token is **not encrypted** in browser storage. Use a read-only token and revoke it in Fastmail if you lose control of your browser profile.
- "Disconnect and clear all data" in the extension's settings removes everything it stores. Uninstalling the extension does too.

## Permissions
See the README for why each permission is requested.
