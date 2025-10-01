# Two-Factor Authentication (2FA) — Requirements (Single‑Author, Minimal)

## 1. Purpose & Scope

Add strong but simple **two-factor authentication (2FA)** for a **single‑author** blog. Support **TOTP** (RFC 6238) and **WebAuthn** (passkeys/security keys). Include **recovery codes** and an optional **“remember this device”** feature.

**In scope**
- Owner login 2FA: enable, verify, recover, remember device.
- Minimal server-side storage & verification.

**Out of scope**
- Staff accounts / teams, role management.
- Enterprise audit trails or SIEM integration.
- SMS/Email OTP delivery (may be added later as emergency fallback).

---

## 2. Goals & Non-Goals

**Goals**
- Strong, low‑maintenance 2FA for a single user.
- Keep UX fast and simple; secure by default.
- Provide recoverability via one‑time **recovery codes**.
- Allow “remember this device” on trusted personal devices.

**Non‑Goals**
- Multi‑user administration, delegated access, or audit analytics.
- Client‑side verification of TOTP or storing secrets in the browser.

---

## 3. Threat Model (Right‑Sized)

- **Password compromise / credential stuffing** → 2FA mitigates.  
- **Phishing** → Prefer **WebAuthn** (phishing resistant); TOTP acceptable as backup.  
- **Replay / brute force of codes** → Rate limiting + small verification window.  
- **Device loss** → Recovery codes, ability to remove authenticators, revoke trusted devices.  
- **Clock skew** → ±1 step allowed; keep server time synced (NTP).

---

## 4. User Stories (Single Author)

- **Enable TOTP:** I can scan a QR, enter a 6‑digit code, and enable TOTP.  
- **Enable WebAuthn:** I can register one or more passkeys/security keys.  
- **Verify on login:** After password (or OAuth), I complete 2FA with TOTP or WebAuthn.  
- **Recovery:** If I lose access, I can use a recovery code to sign in and re‑enroll.  
- **Remember device:** I can skip 2FA on this device for a limited time.  
- **Manage:** I can add/remove authenticators, regenerate recovery codes, and revoke trusted devices.

---

## 5. Functional Requirements

### 5.1 Enrollment (TOTP)
- Server generates a **random Base32 secret** and `otpauth://` URI (issuer = site name, account = owner email).  
- UI shows **QR** + manual key (never store secret in the browser).  
- Owner confirms with a valid **6‑digit** code → **activate** TOTP.  
- On activation, generate **10 recovery codes**; show once; store **hashed** server‑side.

### 5.2 Enrollment (WebAuthn)
- Server issues a registration challenge (RP ID = site domain).  
- Client calls `navigator.credentials.create`; server verifies and stores public key and metadata.  
- Allow **multiple authenticators** (e.g., laptop + phone).

### 5.3 Verification (Login)
- After primary auth succeed, session is **mfa‑pending**.  
- UI offers **WebAuthn** or **TOTP**; link to **Use recovery code**.  
- On success, upgrade session to **mfa**; optionally set **remember‑device** cookie.

### 5.4 Recovery Codes
- **10 codes**, random, single‑use; **hash** at rest (Argon2/bcrypt).  
- Show only at generation time; allow **regenerate** (invalidates old).

### 5.5 Remember This Device (Optional)
- On successful 2FA, server issues long‑lived **httpOnly, Secure** cookie with a random token ID.  
- Server stores **hashed token** with `createdAt`, `lastSeenAt`, `expiresAt` and **user‑agent**; optional partial IP hash.  
- If valid/unexpired on future login, **skip 2FA**.  
- Owner can **revoke** all trusted devices or individual entries.

### 5.6 Minimal Activity Log (Optional)
- Keep a lightweight, local **security activity list** (last 20–50 events) visible only to the owner:  
  - “2FA enabled/disabled,” “passkey added/removed,” “trusted device added/removed,” “recovery codes regenerated.”  
- No PII, no external forwarding—purely for owner awareness. Can be disabled.

---

## 6. Security Requirements

- **Server‑side verification only** for TOTP & recovery codes.  
- **TOTP window:** 30s step, **±1 step** skew. Track last accepted step to reduce replay.  
- **Rate limits:** e.g., 5 attempts/min per IP + small burst; exponential backoff on failures.  
- **CSRF:** Protect forms/APIs; use same‑site cookies.  
- **CSP:** Strict Content Security Policy; avoid `unsafe-inline` in admin.  
- **Transport:** HTTPS + HSTS.  
- **Cookies:** `Secure`, `httpOnly`, `SameSite=Lax/Strict`; short‑lived **mfa‑pending** session.  
- **Secret storage:** Encrypt TOTP secret at rest or keep in a protected table.  
- **Disable 2FA:** Requires fresh login + current second factor; revokes trusted devices.

---

## 7. UX Requirements

- 6‑digit input with **auto‑advance** and **paste** handling.  
- Clear copy for enrollment, recovery, and trusted devices (warn against shared computers).  
- Accessible forms & focus states; mobile‑friendly WebAuthn prompts.  
- Provide **“Use another method”** links (WebAuthn ↔ TOTP ↔ Recovery).  
- Show QR during enrollment until confirmed; never after.

---

## 8. Performance & Ops

- Verification path p95 < **250 ms** server time.  
- Server clock synced (NTP).  
- Remember‑device token lookup is O(1) by indexed token ID.  
- Backups include auth tables; verify restore.
- No external logging pipeline required.

---

## 9. Data Model (Minimal)

**Owner**  
- `id`, `email`, `passwordHash`, `twoFactorEnabled`, `twoFactorEnforcedAt`

**OwnerTotp**  
- `ownerId` (PK/FK), `secretBase32` (encrypted), `createdAt`, `activatedAt`

**OwnerWebAuthnCredential**  
- `id`, `ownerId`, `credentialId`, `publicKey`, `aaguid`, `transports`, `nickname`, `addedAt`, `lastUsedAt`

**OwnerRecoveryCode**  
- `id`, `ownerId`, `codeHash`, `usedAt`, `createdAt`

**TrustedDevice**  
- `id`, `ownerId`, `tokenHash`, `userAgent`, `ipHash`, `createdAt`, `lastSeenAt`, `expiresAt`, `revokedAt`

**(Optional) SecurityActivity**  
- `id`, `ownerId`, `event`, `timestamp`, `metadata` (JSON) — local only

---

## 10. APIs & Routes (Example)

### Enrollment
- `POST /api/2fa/totp/init` → returns otpauth URI (server‑generated)  
- `POST /api/2fa/totp/confirm` → `{ code }` → activates  
- `POST /api/2fa/webauthn/registration/options`  
- `POST /api/2fa/webauthn/registration/verify`

### Verification
- `POST /api/2fa/totp/verify` → `{ code, rememberDevice?: boolean }`  
- `POST /api/2fa/recovery/verify` → `{ code }`  
- `POST /api/2fa/webauthn/authentication/options`  
- `POST /api/2fa/webauthn/authentication/verify`

### Management
- `GET /api/2fa/credentials` (list passkeys) / `DELETE /api/2fa/credentials/:id`  
- `GET /api/2fa/recovery` (returns **new set**, once) / `POST /api/2fa/recovery/regenerate`  
- `GET /api/2fa/trusted-devices` / `DELETE /api/2fa/trusted-devices/:id`  
- `DELETE /api/2fa` (disable; requires current second factor)

### Session
- Pending sessions flagged `mfaPending=true`; on success `mfa=true`.  
- Trusted device cookie name suggestion: `__Host-trustedDevice`.

---

## 11. Acceptance Criteria

- **TOTP**: Accept valid codes within ±1 step; reject others; rate limits enforced.  
- **WebAuthn**: Register ≥2 authenticators; verify assertion end‑to‑end.  
- **Recovery codes**: Single‑use; regeneration invalidates old set.  
- **Remember device**: Cookie is httpOnly/Secure; server can revoke; skipping 2FA works only on valid devices.  
- **Disable flow**: Requires fresh login + second factor; revokes trusted devices.  
- **No audit dependency**: App runs without external logging/monitoring services.

---

## 12. Rollout

1) Ship **TOTP + recovery codes**.  
2) Add **WebAuthn** (encourage registering two authenticators).  
3) Enable **remember device**.  
4) (Optional) Enable minimal local **SecurityActivity** list for owner visibility.

---

## 13. Implementation Hints (Stack‑Agnostic)

- **TOTP** libs: Node (`otplib`, `speakeasy`), .NET (`Otp.NET`).  
- **WebAuthn** libs: Node (`@simplewebauthn/server`), .NET (`fido2-net-lib`).  
- Use **httpOnly** cookies and short‑lived JWTs (if any) for `mfaPending`.  
- Store recovery codes **hashed**; treat like passwords.

