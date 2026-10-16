# Admin area

Internal tool for running the service. **English only** (a decision of the owner), staff only. Everyone else
(customers, visitors) gets a plain "not found" at `/admin`, so the area does not reveal itself.

## How to get in

1. Create a staff account (once, on the machine that has the `.env`):
   ```bash
   pnpm admin:create --email you@example.com --role ADMIN
   ```
   A strong password is generated and printed **once**. Add `--password "..."` to choose your own, and
   `--reset-password` to set a new password for an existing account. `--role SUPPORT` makes a support account.
   Running it for an existing customer account promotes that account and keeps its password.
2. Sign in on the normal login page (`/login`) with that e-mail and password.
3. Open `/admin` (staff also see an **Admin** button at the bottom of the normal menu).
4. Change the generated password: **Settings > Profile > Change password**.

Staff accounts are verified at creation, never get a trial place, and are created only from the command line:
there is no web form that can make someone staff.

## Roles and permissions

All access decisions live in one table, `packages/shared/src/domain/admin.ts` (`can(role, permission)`).
Pages, the menu and the API routes all ask it.

| Permission | ADMIN | SUPPORT |
|---|:-:|:-:|
| `overview.read` (Overview) | yes | yes |
| `users.read` (Users, user page) | yes | yes |
| `users.manage` (early access flag) | yes | no |
| `grants.manage` (give, change, revoke gift places) | yes | no |
| `feedback.manage` (Inbox statuses) | yes | yes |
| `sources.read` (Sources) | yes | yes |
| `stats.read` (Statuses) | yes | yes |
| `audit.read` (Audit log) | yes | no |

To add a role or a permission: edit that file, and the menu in `apps/web/src/components/admin/nav.ts`.

## What is in it

- **Overview**: users, running subscriptions and estimated monthly revenue (by the price ladder), gift places in use,
  active cases, cases with a source error, new inbox messages, waiting Telegram messages, sources needing attention.
- **Users**: search by e-mail or id; one page per account: profile, access (plan, paid / granted places, next
  period), trial and gift places with **give / change end date / revoke**, all cases with source state and
  errors, payments, admin actions on this account.
- **Inbox**: contact-form messages with a status (New, Read, Answered, Spam).
- **Sources**: per source kind, active cases, errors, overdue checks, last successful check, most common errors.
- **Statuses**: every status and stage title seen at the sources (no personal data): the basis for deciding which
  statuses end a case.
- **Audit log**: everything staff changed. Entries are kept after an account is deleted.

## Early access

Some services are held back from ordinary accounts (OCASA is parked this way until there is an agreement with it). Staff always see such services; for any other account an admin
turns **Early access** on in the account block of the user page. The list of such services is `EARLY_ACCESS_KINDS` /
`EARLY_ACCESS_SECTIONS` in `packages/shared`. The change is written to the audit log.

## Giving places (gift, bonus, partner)

On the user page, **Give places**: how many, the type, an end date (or "No end date": it keeps going until revoked)
and a note. Giving places **ends the trial** of that account. The places are used first and cost nothing; when
they end and there are more cases than places, the extra cases wait and the owner gets one Telegram message.
Each form carries a one-time key, so a double click or a repeated submit acts once.

## Safety notes

- Every change is written to the audit log with who did it, on which account, and the values.
- Passwords of staff are like any other: scrypt hashes. **Two-factor sign-in for staff is not built yet** (see the
  plan): before real customers exist, use a long unique password.
- The API under `/api/admin/*` checks the permission on every call, not only the pages.
