# Sign-in emails

Supabase Auth sends the sign-in emails through Resend (SMTP `smtp.resend.com:465`, user
`resend`, password = a Resend API key with sending access to tiltless.xyz; sender
`Tiltless <no-reply@tiltless.xyz>`). The domain was verified in Resend on 2026-10-28 with the
DKIM TXT record and two SPF CNAME records (`rsend`, `send` → `*.forge.rmta.net`) in Namecheap.

## Templates

`web/supabase/templates/` holds the HTML for two Supabase templates, in English, Russian and
Spanish in one file each. The language comes from `user_metadata.locale`, which the app sets on
sign-up and keeps up to date after sign-in (`rememberLocale` in `web/src/app/cloud.ts`); English
when it is missing.

Paste them in Supabase → Authentication → Emails → Templates:

| Template | File | Subject |
| --- | --- | --- |
| Magic Link | `magic-link.html` | `Tiltless: sign in · вход · acceso` |
| Confirm signup | `confirm-signup.html` | `Tiltless: confirm your email · подтверди почту · confirma tu correo` |

A new account gets "Confirm signup" on its first sign-in; after that every sign-in is a
"Magic Link". The subject stays the same in every language, so it carries all three.

Check a change before pasting it: the templates are Go `html/template`, the engine Supabase uses.
Render them with sample data (`.ConfirmationURL`, `.Data.locale` = "ru", "es", none) and look at
the result in a browser.
