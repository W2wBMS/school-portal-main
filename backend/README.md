# Student Portal Backend

## Scripts

- `npm run dev` – start the API with nodemon
- `npm start` – start the API in production mode

## Environment

Copy `.env.example` to `.env` and update values.

Rule configuration:

- `CURRENT_SEMESTER` – semester used by current registration lookups
- `REGISTRATION_START` / `REGISTRATION_END` – ISO timestamps for the registration window
- `MAX_REGISTRATION_CREDITS` – maximum credits allowed in one registration
- `RESULT_COMPONENT_RANGES` – JSON object such as `{"coursework":40,"exam":60}`
- `PAYMENT_WEBHOOK_SECRET` – HMAC secret for the `x-webhook-signature` payment header
- `FRONTEND_URL` – frontend origin used in password-reset links
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` – SMTP delivery settings for password-reset email

Authentication security:

- Set `JWT_SECRET` to a random value at least 32 characters long in production. The API refuses to start with a missing or short production secret. Local development warns about a short configured value and uses a temporary random secret only when the value is missing, so sessions expire when the API restarts in that case.
- Login and password-reset requests are rate limited.
- Five failed passwords temporarily lock an account for 15 minutes.
- Passwords use bcrypt hashing; reset tokens are stored only as SHA-256 hashes and expire after 15 minutes.
- Successful password resets increment the session version and invalidate existing JWT sessions.
- HTTP-only, Secure-in-production, SameSite cookies and CSRF checks protect cookie-authenticated writes.
- The payment webhook returns `503` until `PAYMENT_WEBHOOK_SECRET` is configured; unsigned callbacks are rejected.
- Auth success, failure, registration, and password-reset events are written to `AuditLog`.
- Role permission metadata follows `resource.action` names and is loaded on authenticated requests.

## Routes

- `GET /api/health` – health check
- `GET /api/roles` – available user roles
- `POST /api/auth/register` – register a user
- `POST /api/auth/login` – login with email/password
- `POST /api/auth/logout` – clear auth cookie
- `GET /api/auth/me` – current user payload
- `GET /api/users` – list users (admin only)

Versioned student API:

- `/api/v1/auth/*` – login, logout, current user, and password reset
- `/api/v1/students/me/*` – profile, courses, approved results, and transcript
- `/api/v1/registrations/*` – draft, update, submit, and academic approval/lock
- `/api/v1/fees` and `/api/v1/payments/*` – fee balances and verified payment state
- `/api/v1/requests` and `/api/v1/notifications` – student service requests and notifications

Business rules are enforced server-side. Registration drafts are validated against academic status, window, semester offering, programme/level, prerequisites, duplicate courses, and credit limits. Submitted and approved registrations are immutable. Results calculate grades from validated scores, require lecturer-course authorization, use explicit approval/finalization, and require a reasoned correction workflow after finalization. Business mutations write to `AuditLog`.

## MongoDB Atlas deployment

1. Create an Atlas cluster and database user, then add the deployment host to the cluster network access list.
2. Copy `.env.example` to `.env` and set `MONGO_URI` to the Atlas connection string. URL-encode reserved characters in the password.
3. Set a long random `JWT_SECRET`, `NODE_ENV=production`, and `CORS_ORIGIN` to the deployed frontend origin.
4. Set `PAYMENT_WEBHOOK_SECRET` to a long random value when payment webhooks are enabled.
5. Create the first admin through a controlled setup process, then remove any temporary bootstrap credentials before deployment. Never commit `.env` files.
6. Deploy the backend with `npm install` followed by `npm start`. Confirm `GET /api/health` returns `ok: true`.

The frontend must be built with `NEXT_PUBLIC_API_URL` set to the deployed API base URL, for example `https://api.example.edu/api`. Configure Atlas Network Access with the backend host's stable egress IP or private networking; avoid `0.0.0.0/0` in production.

Before production:

- Rotate any credentials that were exposed during development.
- Use HTTPS so secure cookies and JWT transport are protected.
- Configure database backups and monitor connection, error, and authentication metrics.
- Run `npm test` in `backend` and `npm run build` in `frontend` before release.

CRUD endpoints are protected by role:

- Courses: `POST`, `PATCH`, and `DELETE /api/portal/courses` require academic or system administration roles.
- Attendance: `POST` and `PATCH /api/portal/attendance` require lecturer or academic administration roles.
- Fees: `POST`, `PATCH`, and `DELETE /api/portal/fees` require finance or system administration roles.
- Users: `PATCH` and `DELETE /api/users/:id` require system administration roles.
