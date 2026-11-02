// Shared detection corpus: every registered detector is run against these emails.
// [name, email, want]: want is the expected code (or null), or {v1: ..., v2: ...} when detectors
// are expected to differ. A detector missing from that object skips the case (use "default" to set
// one for all).

export const text = (body, subject = "") => ({ subject, textBody: [{ type: "text/plain", value: body }], htmlBody: [{ type: "text/plain", value: body }] });
// Like JMAP for an HTML-only message: textBody and htmlBody both point at the HTML part.
export const html = (body, subject = "") => ({ subject, textBody: [{ type: "text/html", value: body }], htmlBody: [{ type: "text/html", value: body }] });

// A CI notification (reported false positive): "otp" in the repo name, "code" in prose, and a commit hash.
const ciBody = `[owner/browser-fastmail-otp-detector] CI workflow run

Repository: owner/browser-fastmail-otp-detector
Workflow: CI
Duration: 1 minute and 2.0 seconds
Finished: 2026-11-02 15:46:59 UTC

View results: https://github.com/owner/browser-fastmail-otp-detector/actions/runs/41474801321

Jobs:
  * test failed (3 annotations)

-- 
You are receiving this because you are subscribed to this thread.`;
const ciSubject = "[owner/browser-fastmail-otp-detector] PR run failed: CI - Only offer a code on the site that sent it; keep codes in memory only (92ec27b)";

const storeboxHtml = `<html><head><title>Storebox Email</title></head><body>
<p>This Storebox Authorization code is required for security purposes.</p>
<h3>Storebox Authorization Code: <span style="color:blue">716052</span></h3>
Code expires in 20 minutes. <a href="https://x.com/2026">www</a> &copy; 2026</body></html>`;

const loginNotice = `Subject: Storebox Account Login Notification

This is a notification about your Storebox account.

Hi there,

Someone (hopefully you) just logged in to your Storebox account.

Sign In Details:

Browser/5.0 (X11; Linux x86_64) Engine/537.36 (KHTML) Client/156.0.0.0 Web/537.36

2026-01-15T09:12:30Z

203.0.113.45

LOGIN

If you recognize this activity, you can ignore this message.

If you do not recognize this activity, Storebox recommends logging in (https://x.com/login) and changing your user credentials immediately. For more information refer to our Security Documentation (https://x.com/docs).

Storebox, Inc., 2261 Elm Street, STE 40512, San Francisco, CA 94114`;


// Real HTML emails, trimmed to the structure around the code and the nearby distractors.
const chirpHtml = `<table><tr><td><span><span style="font-size:1.5rem">Here's your code to get back in</span></span></td></tr>
<tr><td><span>Hi Alex Smith,</span></td></tr><tr><td><span>Someone using Chirp requested access to your Chirp account. Use the code below in the app to regain access. After that, you can update your password if you'd like.</span></td></tr>
<tr><td height="24">&nbsp;</td></tr><tr><td><span style="display:block;letter-spacing:8px;">38104726</span></td></tr>
<tr><td><span>Don't share this code with anyone</span></td></tr><tr><td><img src="https://x.com/img.jpg"></td></tr></table>`;
const northbankHtml = `<p>Important information about your account</p><table><tr><td><p><b>MR J SMITH</b></p><p>Account Ending: 400317</p></td></tr></table>
<div><p role="heading">Your Northbank<sup>&reg; </sup>temporary security code</p></div>
<div><p><strong>Dear</strong> <strong>MR J SMITH</strong></p><p>&nbsp;</p><p>You requested a temporary security code be sent to your email. Your temporary security code is:</p></div>
<div><div style="font-size:1.875rem"><p style="margin:0">840193</p></div></div>
<div><p>The security code will expire after 10 minutes.</p><p>Copyright 2011. Northbank Company All Rights Reserved.</p>
<p>Registered in England and Wales with number 4729061.</p><p>Payment Services Regulations 2009 (reference number 628104) for the provision of payment services.</p><p>KTW0PLM385</p></div>`;
const trailgearHtml = `<h1>Your Trailgear verification code</h1>
<table><tr><td> Hi there,<br><br>Here&rsquo;s your code - it&rsquo;s valid for the next 15 minutes. It&rsquo;s just for you, so please don&rsquo;t share it with anyone:
</td></tr></table><h2 style="font-size:1.875rem">362917</h2><h6>Didn&rsquo;t request this?</h6>
<table><tr><td>1.</td><td>It&rsquo;s sent from @trailgear.com</td></tr></table>
<table><tr><td> Trailgear UK Limited trading as Trailgear is a company registered in England with company number: 05817362. VAT number: GB418375920. <br><br><br><span>&copy;2025 Trailgear</span></td></tr></table>`;
const storebox2Html = `<html><head><title>Storebox Email</title></head><body><table><tr><td>
<p>This Storebox Authorization code is required for security purposes.</p>
<h3 style="font-weight:300; font-size: 24px;">
     Storebox Authorization Code: <span style="color:blue">645813</span>
</h3>
Code expires in 20 minutes.
</td></tr></table><img src="https://x.com/open" width="1" height="1"/></body></html>`;
const shopzenHtml = `<div style="display:none"><img src="https://x.com/open?t=verifycode-2026-10-29"/></div><br/><!--account_verifycode#\${jobId}--><table width="700"><tbody><tr><td>
  <div><div style="line-height: 1.5;">
    <strong style="display: block;">
       Hi
    </strong>
    <strong style="display: block;">
Please enter the 6-digit code below on the email verification page:
        <span style="color: #ff6600;font-size: 24.0px;">591374</span> </p>
Remember, beware of scams and keep this one-time verification code confidential.
        </p>
    </strong>
    <p>Thanks, <br>The Shopzen Team</p>
  </div></div></td></tr></tbody></table>`;

const fanhubHtml = `<html><head><style>p{margin:13px 0;}</style></head><body>
<div><table><tr><td><h1 style="font-size:27px;">Here\u2019s your login code</h1></td></tr></table></div>
<div><p style="margin-top:0;">Copy and paste the code below to log in to your Fanhub account.<br><br>The code expires in 15 minutes.</p></div>
<div><div style="height:16px;">\u200a</div></div>
<div><div style="font-size:15px;">
<span style="font-family:&quot;Brand Sans&quot;,Arial; font-size: 24px; letter-spacing: 0.2em;">QK4R7W</span>
 </div></div>
<div><p>If this wasn\u2019t you, please <a href="https://x.com/c">change your password immediately</a>.</p></div>
<div> 600 Pine Street <br> San Francisco, CA 94103 <br><br> This email was sent to <a href="mailto:a@b.c">a@b.c</a></div></body></html>`;

const skyhopHtml = `<html><head><meta charset="utf-8"></head><body><style>p{margin:0}</style><center><table><tbody><tr><td>
  <table><tr><td><a href="https://x.com/"><img alt="Skyhop"/></a></td></tr></table>
  <!--[raw][if mso | IE][/raw]><table><tr><td><![raw][endif][/raw]-->
  <table><tr><td style="font-size:14px">
     <!-- Space --><table><tbody><tr><td width="5" height="30"></td></tr></tbody></table><!-- /Space -->
     Hi Alex Smith, <br><br>
     It looks like you've tried to access your account from an unknown device.
     Please enter the below code to complete the authorisation process.
     Code is valid for 10 minutes only.
     <!-- Space --><table><tbody><tr><td width="5" height="20"></td></tr></tbody></table><!-- /Space -->
     <table width="180"><tr><td style="font-size: 30px;font-weight: bold;">
         vbtmqrje
     </td></tr></table>
     Thank you,
     <br><br>
     The Team at Skyhop
  </td></tr></table>
  <div><a href="https://x.com/">If you did not request this code, please let our customer service team know.</a></div>
  <div><span>\u00a9 2026 Skyhop DAC</span>&nbsp;<a href="https://x.com/"><strong>Terms &amp; Conditions</strong></a></div>
</td></tr></tbody></table></center></body></html>`;

export const cases = [
  ["storebox html", html(storeboxHtml, "Storebox Authorization Code"), "716052"],
  ["plain", text("Your verification code is 482913"), "482913"],
  ["hyphenated", text("Use code 123-456 to sign in"), "123456"],
  ["spaced", text("Your code: 123 456"), "123456"],
  ["code first line, number next", text("Your code is:\n\n831204\n\nIt expires soon."), "831204"],
  ["number first", text("482913 is your verification code"), "482913"],
  ["pin", text("Your login PIN: 7731"), "7731"],
  ["OTP", text("OTP 90412 for your transaction"), "90412"],
  ["no keyword gate for strong match", text("Here is your code 556677"), "556677"],
  ["bare number mid-sentence is not enough", text("Please verify your sign-in. 394021"), null],
  ["mid-sentence numbers with verify word", text("Verify sign-in 1234 or 987654"), null],
  ["url digits ignored", text("Verify your account https://x.com/v/839201 code 112233"), "112233"],
  ["year rejected", text("Security alert 2024 sign-in from new device"), null],
  ["year with code", text("Verification code expires 2026-01-01, code 445566"), "445566"],
  ["order number", text("Order #12345 shipped, confirm by 2026"), null],
  ["price", text("Confirm your payment of $1234 today"), null],
  ["phone", text("Verify your account, call +4412345678"), null],
  ["zip code", text("Confirm your zip code 90210"), null],
  ["promo code", text("Use promo code 202020 for 10% off"), null],
  ["newsletter", text("Weekly digest: 5 articles you may like 2026"), null],
  ["barcode is not a code", text("Your barcode 12345678 is ready"), null],
  ["zipcode is not a code", text("Confirm your zipcode 90210"), null],
  ["word ending in a blocked word", text("Your preorder code 735291"), "735291"],
  ["skips area code, finds real one", text("Area code 4412. Your verification code is 556677"), "556677"],
  ["login notification email (street number, zip, IP, date)", text(loginNotice), null],
  ["login notification as stripped HTML", html("<p>Someone just logged in to your account.</p><p>203.0.113.45</p><p>2026-01-15T09:12:30Z</p><p>Security Documentation</p><p>Storebox, Inc., 2261 Elm Street, STE 40512, San Francisco, CA 94114</p>"), null],
  ["verify word but only an address", text("Please verify your account. Acme, 2261 Elm Street, CA 94114"), null],
  ["code alone on its own line", text("To verify your identity, enter:\n\n4821\n\nThanks"), "4821"],
  ["chirp html", html(chirpHtml), "38104726"],
  ["northbank html (account ending, reference number)", html(northbankHtml), "840193"],
  ["trailgear html (company number, 15 minutes)", html(trailgearHtml), "362917"],
  ["storebox html, multi-line", html(storebox2Html), "645813"],
  ["shopzen html (6-digit, date in url)", html(shopzenHtml), "591374"],
  ["compact date alone on a line", text("Verify your account\n\n20261102\n\nThanks"), null],
  ["account ending after code word", text("Your code was sent. Account ending 400317"), null],
  ["html date in its own cell", html("<p>Your verification is complete.</p><td>20261102</td>"), null],
  ["no space after colon, 4 digits", text("[User Information]Security code:9152 ,expires in 30 minutes."), "9152"],
  ["fanhub html, alphanumeric code", html(fanhubHtml), "QK4R7W"],
  ["alphanumeric needs a digit", text("Your login code\n\nACCOUNT\n"), null],
  ["alphanumeric reference too long", text("Verify\n\nKTW0PLM385\n"), null],
  ["skyhop html, lowercase letter code", html(skyhopHtml), "vbtmqrje"],
  ["word after code line is not a code", text("Didn't request this code?\nThanks\nRegards"), null],
  ["titlecase word after code line", text("Your verification code was used.\nSkyhop"), null],
  ["letters far from code line", text("Your code was used.\nline two\nline three\nvbtmqrje"), null],
  // More positives
  ["subject line only", text("Your Gamebox login code: 8KX2P\n"), { v1: null, v2: "8KX2P" }],
  ["code in subject, body html", html("<p>Hi,</p><p>Someone tried to log in.</p>", "123456 is your Snapgrid code"), "123456"],
  ["verification code with colon and newline", text("Verification code:\n739104"), "739104"],
  ["one-time passcode", text("Your one-time passcode is 50 81 33"), { v1: null, v2: "508133" }],
  ["passcode word", text("Enter passcode 662301 to continue"), "662301"],
  ["OTP lowercase", text("otp: 4821"), "4821"],
  ["8-digit code", text("Your security code is 38104726"), "38104726"],
  ["code in a table cell", html("<p>Enter this verification code:</p><table><tr><td>  731942  </td></tr></table>"), "731942"],
  ["code inside bold within a paragraph line", html("<p>Your code is <b>482913</b>.</p>"), "482913"],
  ["entity-encoded apostrophe before code", html("<p>Here&#39;s your code:</p><h2>551204</h2>"), "551204"],
  ["hex entity", html("<p>Here&#x2019;s your verification code</p><div>662091</div>"), "662091"],
  ["alphanumeric with digit next to code line", text("Use this code to sign in:\nA7K9QZ\nIt expires soon."), "A7K9QZ"],
  ["lowercase alnum next to code line", text("Your login code:\nk3x9pq2m"), "k3x9pq2m"],
  ["code then sign-off", text("Your verification code\n\n904417\n\nThanks,\nThe Team"), "904417"],
  ["code skips expiry minutes", text("Your code expires in 10 minutes:\n\n318842"), "318842"],
  ["first real code wins over footer number", html("<p>Your verification code</p><p>402918</p><p>Registered number 4729061</p>"), "402918"],

  ["plain text, trailing period and space", text("Your verification code is 978469. "), "978469"],

  // More negatives
  ["shipping notification", text("Your order 4829173 has shipped. Track it with tracking code 1Z999AA"), null],
  ["newsletter with year and price", html("<h1>Spring sale 2026</h1><p>Save 25%</p><p>Only $1999</p>"), null],
  ["receipt total alone on a line", html("<p>Thanks for your purchase</p><td>1999</td>"), null],
  ["login notice with time alone on a line", html("<p>New sign-in to your account</p><p>14:32</p><p>London, UK</p>"), null],
  ["invoice number with verify word", text("Please verify invoice number 552019 before payment"), null],
  ["reference number near code word", text("Reference number: 774201. No code required."), null],
  ["date dd/mm/yyyy", text("Your verification expires 02/11/2026"), null],
  ["ISO date alone with verify word", text("Verify your email\n2026-11-02\n"), null],
  ["compact DDMMYYYY alone", text("Verify your email\n02112026\n"), null],
  ["phone number after code word", text("Didn't request a code? Call 0800 123 4567"), null],
  ["postcode after code word", text("Postal code: 94103"), null],
  ["discount code alone after promo text", text("Use this discount code at checkout:\nSAVE20"), null],
  ["voucher code alone after promo text", text("Your voucher code:\nxmasgift"), null],
  ["titlecase word after verify line", text("Verify your email address\nWelcome\nThanks"), null],
  ["sentence after code line", text("Your code was sent\nplease check your phone"), null],
  ["no verify words, number alone", text("Weekly report\n\n482913\n\nSee you next week"), null],
  ["css leftovers ignored", html("<style>.a{width:600px}</style><p>Your verification code</p><p>See the app.</p>"), null],
  ["html comment digits ignored", html("<!-- 482913 --><p>Verify your account</p>"), null],
  ["url digits ignored in html", html('<p>Verify: <a href="https://x.com/v/839201">click</a></p>'), null],
  ["empty", text(""), null],

  // v2: layout, hidden text, languages, ambiguity. v1 is not expected to handle these.
  ["split digits, one per cell", html("<p>Your verification code:</p><table><tr><td>4</td><td>8</td><td>2</td><td>9</td><td>1</td><td>7</td></tr></table>"), { v2: "482917" }],
  ["spaced digits alone", text("Enter this code to sign in:\n\n4 8 2 9 1 7\n"), { v2: "482917" }],
  ["hidden preheader decoy", html('<div style="display:none;max-height:0;overflow:hidden">Order 553311 update</div><p>Your login code</p><h2>620184</h2>'), { v2: "620184" }],
  ["font-size 0 decoy", html('<span style="font-size:0">771122</span><p>Your code is <b>304918</b></p>'), { v2: "304918" }],
  ["white on white decoy", html('<p style="color:#fff;background-color:#fff">code 111999</p><p>Your sign-in code:</p><p>582036</p>'), { v2: "582036" }],
  ["german", text("Ihr Bestätigungscode lautet: 739201. Er ist 10 Minuten gültig."), { v2: "739201" }],
  ["spanish", text("Tu código de verificación es 615283"), { v2: "615283" }],
  ["chinese", text("您的验证码是 902731，5分钟内有效。"), { v2: "902731" }],
  ["code before 'is your code' in body", html("<p>Hi,</p><p><b>MQ7-4KD</b> is your sign-in code.</p>"), { v2: "MQ7-4KD" }],
  ["grouped alphanumeric", text("Your recovery code: AB12-CD34"), { v2: "AB12-CD34" }],
  ["account mention after code word", html("<p>Use this code to sign in to your account:</p><p style=\"font-size:28px\">846201</p>"), { v2: "846201" }],
  ["subject code repeated in body", html("<p>Enter the code below.</p><p>318274</p>", "318274 is your Acme code"), { v2: "318274" }],
  ["two different codes is ambiguous", text("Your code is 482913. Your backup code is 519203."), { v2: null }],
  ["promo email with code word", html("<h1>Sale!</h1><p>Use code <b>SUMMER25</b> for 25% off your order</p>"), { v2: null }],
  ["promo code alone", html("<p>Your discount code:</p><h2>X7KQ92</h2>"), { v2: null }],
  ["referral code", text("Share your referral code: 7HG2KX"), { v2: null }],
  ["order confirmation number", html("<p>Your order is confirmed.</p><p>Confirmation number:</p><p>Q8ZR2T</p>"), { v2: null }],
  ["ticket with verify word", text("Please verify your booking.\nTicket 48201933\n"), { v2: null }],
  ["time and date with code word", text("Your code was used at 10:42 on 02/11/2026."), { v2: null }],
  ["price after code word", text("Code applied. You saved $1250 today."), { v2: null }],
  ["quantity", text("Your verification storage: 2048 GB used"), { v2: null }],
  ["ip address", text("New sign-in verification from 192.168.100.200"), { v2: null }],
  ["phone with spaces", text("Didn't ask for a code? Call us on 020 7946 0958."), { v2: null }],
  ["version string", text("Authenticator app v2.10.4 update"), { v2: null }],
  ["word and number", text("Your verification code\n\nOrbit11\n"), { v2: null }],
  ["uppercase word alone", text("Your verification code\n\nWELCOME\n"), { v2: null }],
  ["code in a link", html('<p>Verify your email: <a href="https://x.test/">482913</a></p>'), { v2: null }],
  ["footer number under code line", html("<p>Your code was sent.</p><p>Acme Inc, 2261 Elm Street, Suite 800</p><p>94114</p>"), { v2: null }],
  ["CI notification with a commit hash in the subject", text(ciBody, ciSubject), { v2: null }],
  ["git hash after a code mention", text("Review the code changes in commit 92ec27b before merging.\n\nThe verification build passed."), { v2: null }],
  ["new sign-in notice", html("<p>New sign-in to your account</p><p>Location: London</p><p>Time: 14:32</p><p>Device ID 448812</p>"), { v2: null }],
  ["labelled lowercase hex code", text("Your verification code is 9f3a2c1e"), { v2: "9f3a2c1e" }],
  ["code in brackets right after the label", text("Your verification code is (482913)"), { v2: "482913" }],

];
