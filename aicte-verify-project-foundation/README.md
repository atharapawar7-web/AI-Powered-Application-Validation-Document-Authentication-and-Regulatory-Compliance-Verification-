# AICTE-VERIFY (Prototype)

Smart India Hackathon 2026 – PS ID 26261  
**Theme:** AI-Powered Application Validation, Document Authentication and Regulatory Compliance Verification

## Phase 1 Delivered (Foundation)

- Role-based auth: `admin`, `officer`, `institution`
- Session auth with secure HTTP-only cookies
- MFA (TOTP) setup + verify endpoints
- Access logging (auth, guard failures, admin actions)
- YAML-driven application categories and checklists
- Synthetic dataset seeding from YAML
  - 4 fake institutions
  - mock AICTE records
  - seeded applications
  - 6 synthetic document types with deliberate flags:
    - tampered
    - expired
    - missing
    - mismatched
- English/Hindi UI toggle dashboard
- Principle displayed in UI: **"AI recommends - Evidence explains - Officials decide"**
- Explicit non-automation warning: **No auto-reject**

## Config Files

- `config/application_categories.yaml` → categories + checklist items
- `config/synthetic_dataset.yaml` → institutions, users, records, and document templates

## Local Run

1. Install dependencies
   - `npm install`
2. Ensure PostgreSQL is available at:
   - `postgresql://postgres:postgres@127.0.0.1:5432/app_db`
3. Push schema
   - `npx drizzle-kit push`
4. Start app
   - `npm run dev`
5. Open
   - `http://localhost:3000`

## First-Time Bootstrap

- Click **"Load YAML rules + synthetic dataset"** on the dashboard.
- This creates all seed users/institutions/records/checklists.

## Demo Credentials (after bootstrap)

- Admin: `admin@aicte-verify.demo` / `Admin@123`
- Officer: `officer1@aicte-verify.demo` / `Officer@123`
- Institution users (all password `Inst@123`):
  - `nodal.delhi@aicte-verify.demo`
  - `nodal.pune@aicte-verify.demo`
  - `nodal.lucknow@aicte-verify.demo`
  - `nodal.blr@aicte-verify.demo`

## Docker Compose Run

1. `docker compose up --build`
2. Open `http://localhost:3000`
3. Click bootstrap button in UI.

## API Endpoints (Phase 1)

- `POST /api/admin/bootstrap`
- `GET /api/foundation/summary`
- `GET /api/admin/access-logs`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/mfa/setup`
- `POST /api/auth/mfa/verify`

## Security Notes (Prototype)

- Synthetic data only
- MFA is optional but fully functional
- Access log captures action/resource/method/success metadata
- No autonomous rejection logic in this phase
