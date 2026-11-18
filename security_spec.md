# Security Specification & Payload-First TDD (`security_spec.md`)

## 1. Data Invariants & Master Source of Truth
1. **Master Identity Separation**:
   - `students/{nis}` and `proctors/{proctorId}` store SHA-256 credential hashes (`passHash`) only; plaintext reference passwords live in `student_credentials/{nis}` and `proctor_credentials/{proctorId}` restricted exclusively to `isAdmin()`.
   - A student or proctor acquires a verified session document (`student_sessions/{uid}` or `proctor_sessions/{uid}`) only when Firebase Auth provides a verified Google account (`email_verified == true`) AND the server-side `get()` in Firestore Security Rules confirms `passHash` matches the master record.
2. **Cross-Device Persistence Integrity**:
   - Student exam answers, remaining timer (`timeLeft`), room choice (`ruang`), and final status are stored in `exam_sessions/{nis}`.
   - Students may read or update `exam_sessions/{nis}` ONLY when `student_sessions/{request.auth.uid}.nis == nis` AND `existing().status != 'Selesai'` (terminal state locking).
3. **Zero Blanket List Queries**:
   - No collection allows `allow list: if isSignedIn();`.
   - Students cannot list `students`, `student_credentials`, `proctors`, `proctor_credentials`, `app_secrets`, or `archives`.
   - List access on `exam_sessions`, `violations`, and `photos` for students enforces `resource.data.ownerUid == request.auth.uid`.
4. **Strict Timestamps & Payload Bounds**:
   - Every create operation enforces `createdAt == request.time` (or `updatedAt == request.time`).
   - Every string and list enforces explicit upper bounds via `.size()`.
   - Ghost fields are blocked by `keys().hasAll(...) && keys().hasOnly(...)` on create and `diff(existing()).affectedKeys().hasOnly(...)` on update.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Admin Spoof**: Token email matches `kipaskoplak@gmail.com` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **Ghost Field Injection (Shadow Update)**: Student updates `exam_sessions/1001` injecting `isAdminBypass: true` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Privilege**: Authenticated student attempts `create` on `/admins/{uid}` -> `PERMISSION_DENIED`.
4. **Wrong Password Session Claim**: Student creates `/student_sessions/{uid}` with wrong `passHash` -> `PERMISSION_DENIED`.
5. **Cross-Student Session Hijack**: Verified student for NIS `1001` tries to read or update `/exam_sessions/1002` -> `PERMISSION_DENIED`.
6. **Terminal State Replay (Re-submit After Finish)**: Student tries to modify `answers` or `score` on `/exam_sessions/1001` after `status == 'Selesai'` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Single-document write targeting a 500-character or invalid regex ID `../hack` -> `PERMISSION_DENIED`.
8. **Timestamp Forgery**: Student creates `/exam_sessions/1001` with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
9. **Blanket Collection Scraping**: Student runs `getDocs(collection(db, 'students'))` or `getDocs(collection(db, 'student_credentials'))` -> `PERMISSION_DENIED`.
10. **PII / Secret Exfiltration**: Student attempts `getDoc(doc(db, 'app_secrets', 'private'))` to read plaintext token or `email_wali` -> `PERMISSION_DENIED`.
11. **Value Poisoning**: Student sends a boolean or 50KB string in `exam_sessions.nis` or `ruang` -> `PERMISSION_DENIED`.
12. **Immutable Ownership Tampering**: Student updates `/exam_sessions/1001` changing `nis` or `createdAt` -> `PERMISSION_DENIED`.
