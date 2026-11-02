import { extractCode, htmlToText, maskCode, maskIn } from "../otp.js";

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

// [name, text, expected]
const cases = [
  ["storebox html", "Storebox Authorization Code\n" + htmlToText(storeboxHtml), "716052"],
  ["plain", "Your verification code is 482913", "482913"],
  ["hyphenated", "Use code 123-456 to sign in", "123456"],
  ["spaced", "Your code: 123 456", "123456"],
  ["code first line, number next", "Your code is:\n\n831204\n\nIt expires soon.", "831204"],
  ["number first", "482913 is your verification code", "482913"],
  ["pin", "Your login PIN: 7731", "7731"],
  ["OTP", "OTP 90412 for your transaction", "90412"],
  ["no keyword gate for strong match", "Here is your code 556677", "556677"],
  ["bare number mid-sentence is not enough", "Please verify your sign-in. 394021", null],
  ["mid-sentence numbers with verify word", "Verify sign-in 1234 or 987654", null],
  ["url digits ignored", "Verify your account https://x.com/v/839201 code 112233", "112233"],
  ["year rejected", "Security alert 2024 sign-in from new device", null],
  ["year with code", "Verification code expires 2026-01-01, code 445566", "445566"],
  ["order number", "Order #12345 shipped, confirm by 2026", null],
  ["price", "Confirm your payment of $1234 today", null],
  ["phone", "Verify your account, call +4412345678", null],
  ["zip code", "Confirm your zip code 90210", null],
  ["promo code", "Use promo code 202020 for 10% off", null],
  ["newsletter", "Weekly digest: 5 articles you may like 2026", null],
  ["barcode is not a code", "Your barcode 12345678 is ready", null],
  ["zipcode is not a code", "Confirm your zipcode 90210", null],
  ["word ending in a blocked word", "Your preorder code 735291", "735291"],
  ["skips area code, finds real one", "Area code 4412. Your verification code is 556677", "556677"],
  ["login notification email (street number, zip, IP, date)", loginNotice, null],
  ["login notification as stripped HTML", htmlToText("<p>Someone just logged in to your account.</p><p>203.0.113.45</p><p>2026-01-15T09:12:30Z</p><p>Security Documentation</p><p>Storebox, Inc., 2261 Elm Street, STE 40512, San Francisco, CA 94114</p>"), null],
  ["verify word but only an address", "Please verify your account. Acme, 2261 Elm Street, CA 94114", null],
  ["code alone on its own line", "To verify your identity, enter:\n\n4821\n\nThanks", "4821"],
  ["chirp html", htmlToText(chirpHtml), "38104726"],
  ["northbank html (account ending, reference number)", htmlToText(northbankHtml), "840193"],
  ["trailgear html (company number, 15 minutes)", htmlToText(trailgearHtml), "362917"],
  ["storebox html, multi-line", htmlToText(storebox2Html), "645813"],
  ["shopzen html (6-digit, date in url)", htmlToText(shopzenHtml), "591374"],
  ["compact date alone on a line", "Verify your account\n\n20261102\n\nThanks", null],
  ["account ending after code word", "Your code was sent. Account ending 400317", null],
  ["html date in its own cell", htmlToText("<p>Your verification is complete.</p><td>20261102</td>"), null],
  ["no space after colon, 4 digits", "[User Information]Security code:9152 ,expires in 30 minutes.", "9152"],
  ["fanhub html, alphanumeric code", htmlToText(fanhubHtml), "QK4R7W"],
  ["alphanumeric needs a digit", "Your login code\n\nACCOUNT\n", null],
  ["alphanumeric reference too long", "Verify\n\nKTW0PLM385\n", null],
  ["skyhop html, lowercase letter code", htmlToText(skyhopHtml), "vbtmqrje"],
  ["word after code line is not a code", "Didn't request this code?\nThanks\nRegards", null],
  ["titlecase word after code line", "Your verification code was used.\nSkyhop", null],
  ["letters far from code line", "Your code was used.\nline two\nline three\nvbtmqrje", null],
  // More positives
  ["subject line only", "Your Gamebox login code: 8KX2P\n", null],
  ["code in subject, body html", "123456 is your Snapgrid code\n" + htmlToText("<p>Hi,</p><p>Someone tried to log in.</p>"), "123456"],
  ["verification code with colon and newline", "Verification code:\n739104", "739104"],
  ["one-time passcode", "Your one-time passcode is 50 81 33", null],
  ["passcode word", "Enter passcode 662301 to continue", "662301"],
  ["OTP lowercase", "otp: 4821", "4821"],
  ["8-digit code", "Your security code is 38104726", "38104726"],
  ["code in a table cell", htmlToText("<p>Enter this verification code:</p><table><tr><td>  731942  </td></tr></table>"), "731942"],
  ["code inside bold within a paragraph line", htmlToText("<p>Your code is <b>482913</b>.</p>"), "482913"],
  ["entity-encoded apostrophe before code", htmlToText("<p>Here&#39;s your code:</p><h2>551204</h2>"), "551204"],
  ["hex entity", htmlToText("<p>Here&#x2019;s your verification code</p><div>662091</div>"), "662091"],
  ["alphanumeric with digit next to code line", "Use this code to sign in:\nA7K9QZ\nIt expires soon.", "A7K9QZ"],
  ["lowercase alnum next to code line", "Your login code:\nk3x9pq2m", "k3x9pq2m"],
  ["code then sign-off", "Your verification code\n\n904417\n\nThanks,\nThe Team", "904417"],
  ["code skips expiry minutes", "Your code expires in 10 minutes:\n\n318842", "318842"],
  ["first real code wins over footer number", htmlToText("<p>Your verification code</p><p>402918</p><p>Registered number 4729061</p>"), "402918"],

  ["plain text, trailing period and space", "Your verification code is 978469. ", "978469"],

  // More negatives
  ["shipping notification", "Your order 4829173 has shipped. Track it with tracking code 1Z999AA", null],
  ["newsletter with year and price", htmlToText("<h1>Spring sale 2026</h1><p>Save 25%</p><p>Only $1999</p>"), null],
  ["receipt total alone on a line", htmlToText("<p>Thanks for your purchase</p><td>1999</td>"), null],
  ["login notice with time alone on a line", htmlToText("<p>New sign-in to your account</p><p>14:32</p><p>London, UK</p>"), null],
  ["invoice number with verify word", "Please verify invoice number 552019 before payment", null],
  ["reference number near code word", "Reference number: 774201. No code required.", null],
  ["date dd/mm/yyyy", "Your verification expires 02/11/2026", null],
  ["ISO date alone with verify word", "Verify your email\n2026-11-02\n", null],
  ["compact DDMMYYYY alone", "Verify your email\n02112026\n", null],
  ["phone number after code word", "Didn't request a code? Call 0800 123 4567", null],
  ["postcode after code word", "Postal code: 94103", null],
  ["discount code alone after promo text", "Use this discount code at checkout:\nSAVE20", null],
  ["voucher code alone after promo text", "Your voucher code:\nxmasgift", null],
  ["titlecase word after verify line", "Verify your email address\nWelcome\nThanks", null],
  ["sentence after code line", "Your code was sent\nplease check your phone", null],
  ["no verify words, number alone", "Weekly report\n\n482913\n\nSee you next week", null],
  ["css leftovers ignored", htmlToText("<style>.a{width:600px}</style><p>Your verification code</p><p>See the app.</p>"), null],
  ["html comment digits ignored", htmlToText("<!-- 482913 --><p>Verify your account</p>"), null],
  ["url digits ignored in html", htmlToText('<p>Verify: <a href="https://x.com/v/839201">click</a></p>'), null],
  ["empty", "", null],
];

let failed = 0;
for (const [name, text, want] of cases) {
  const got = extractCode(text);
  if (got !== want) { failed++; console.log(`FAIL ${name}: got ${got}, want ${want}`); }
}
for (const [c, want] of [["482913", "••••13"], ["7731", "•••1"], ["90412", "••••2"]]) {
  if (maskCode(c) !== want) { failed++; console.log(`FAIL mask ${c}: ${maskCode(c)}`); }
}
for (const [text, code, want] of [
  ["482913 is your code", "482913", "••••13 is your code"],
  ["Use 123-456 to sign in", "123456", "Use ••••56 to sign in"],
  ["Order 91234567 shipped", "123456", "Order 91234567 shipped"],
  ["No code here", "123456", "No code here"],
]) {
  if (maskIn(text, code) !== want) { failed++; console.log(`FAIL maskIn "${text}": ${maskIn(text, code)}`); }
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
