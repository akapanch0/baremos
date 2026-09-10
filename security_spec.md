# Security Specification & Threat Model - BAREMO

## 1. Data Invariants
1. **Identity & Ownership**: Any record created under `/users/{userId}/...` must belong exclusively to `request.auth.uid == userId`. Cross-tenant writes or reads are strictly denied.
2. **Path & ID Hardening**: Document IDs and path variables must adhere to alphanumeric constraints (`^[a-zA-Z0-9_\\-]+$`) with a maximum length of 128 characters.
3. **Immutability of Identity**: `userId` and `legajo` fields cannot be altered once created.
4. **Data Isolation & PII Protection**: User personal data and work logs can only be read and listed by their authenticated owner or by an authorized system admin.
5. **Schema Validation**: Every write (create and update) must pass strict type, size, and presence checks via standalone `isValid[Entity]` validators.
6. **Query Boundaries**: List queries must be scoped to the authenticated user's own path (`/users/$(request.auth.uid)/...`), eliminating unauthorized data scraping.
7. **Admin Privilege Verification**: Administrator status is checked via document lookup against `/admins/$(request.auth.uid)` or verified admin email token (`jagarcia0109@gmail.com`).

---

## 2. The "Dirty Dozen" Threat Payloads (Must be rejected with PERMISSION_DENIED)

1. **Payload 1 (Cross-Tenant Profile Hijack)**: Unauthenticated or non-matching UID attempting to write to `/users/{targetUserId}`.
2. **Payload 2 (Ghost Field Injection)**: A user profile payload containing arbitrary injection fields (e.g. `{ "isAdmin": true, "superUser": true }`).
3. **Payload 3 (Oversized String / Denial of Wallet)**: A jornada write with a `legajo` of 5,000 characters.
4. **Payload 4 (Malformed ID Path Variable)**: Accessing a document with an invalid ID containing path injection characters (e.g., `../../malicious`).
5. **Payload 5 (Identity Spoofing in Jornada)**: Creating a jornada record under user A with `userId: "user_B"`.
6. **Payload 6 (Immutable Field Tampering)**: Attempting to update a jornada's `userId` or `fecha` to a different contractor.
7. **Payload 7 (Unverified Email Write)**: Write attempted with an unverified authentication token when email verification is required.
8. **Payload 8 (Invalid Total Type Injection)**: Writing a combustible or jornada record where `total` or `monto` is a string or boolean instead of a number.
9. **Payload 9 (Unbounded List Injection)**: Attempting to push a massive array into `items` exceeding capacity limits.
10. **Payload 10 (Unauthorized Admin Self-Promotion)**: An ordinary contractor attempting to write or create an entry in `/admins/{uid}`.
11. **Payload 11 (Blanket Query Scraping)**: A non-owner attempting a collection-group or open query across all users' jornadas.
12. **Payload 12 (Negative or Infinite Numeric Values)**: Writing numeric financial fields with corrupted or negative boundaries where strictly positive values are required.
