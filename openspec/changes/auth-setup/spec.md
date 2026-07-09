# user-auth Specification (New Capability)

Full spec published at `openspec/specs/user-auth/spec.md`.

## Requirements Added

| ID | Name | Type |
|----|------|------|
| AUTH-ENV | Local Supabase + Google OAuth | Infrastructure |
| AUTH-CLIENT | Supabase SSR client helpers | Infrastructure |
| AUTH-REGISTER | Email/password registration | Functional |
| AUTH-LOGIN | Email/password sign-in | Functional |
| AUTH-OAUTH | Google OAuth sign-in | Functional |
| AUTH-PROXY | Route protection via proxy.ts | Infrastructure |
| AUTH-PROFILE | Profiles table + auto-creation | Data + Functional |
| AUTH-LOGOUT | Sign-out | Functional |
| AUTH-ERRORS | Error state handling | Functional |

**9 requirements, 15 scenarios** (7 happy path, 8 edge/error).
