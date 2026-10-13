# Render Deployment

This repository is prepared as a two-service Render Blueprint:

- `rucst-student-portal-web`: Next.js frontend
- `rucst-student-portal-api`: Express API

Both services use the Frankfurt region. The Next.js server proxies `/api/*` requests to the backend over Render's private network. The browser therefore calls a same-origin API, which keeps the existing secure, HTTP-only `SameSite=Lax` login cookies first-party.

## Before deployment

1. Push this repository to a Git provider connected to Render.
2. Create a MongoDB Atlas cluster in or near Frankfurt, and create a database user for this app.
3. Allow the Render backend to reach Atlas. Prefer a supported stable outbound IP or private networking; do not use `0.0.0.0/0` for a production database unless there is no alternative and the risk is accepted.
4. In Render, choose **New >Blueprint**, select the repository, and use the root `render.yaml` file.
5. Provide the prompted `MONGO_URI`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` values. Use a strong unique bootstrap password. Render generates `JWT_SECRET` automatically.
6. Wait for the API and frontend deploys. The API health check is `https://rucst-student-portal-api.onrender.com/api/health` and should report `ok: true` after MongoDB connects.
7. Sign in through the frontend service URL and confirm the dashboard and API-backed pages load.

The API's startup seeds the initial super-admin only if the configured email does not already exist. Demo academic records are intentionally disabled in production. After deployment, sign in as an administrator and use **Users > Upload admission CSV** to import the admissions list into MongoDB. Account claiming reads from that database list; the local `backend/data/admissions.csv` is ignored by Git and is never required on the Render filesystem.

## Configuration

The Blueprint supplies the production settings used by the app:

- `MONGO_URI`: Atlas connection string, stored as a Render secret.
- `JWT_SECRET`: generated secret with the required production length.
- `CORS_ORIGINS`: comma-separated exact frontend origins permitted by API CORS. Production should contain only the deployed frontend origin; local origins are allowed automatically outside production.
- `FRONTEND_URL`: generated frontend origin used for password-reset links.
- `NEXT_PUBLIC_API_URL=/api`: keeps browser API calls on the frontend origin.
- `BACKEND_HOSTPORT`: Render private hostname and port, referenced from the API service.
- The protected admissions import stores only the fields needed for verification in MongoDB, so admissions data does not need to be committed to Git or written to Render's ephemeral filesystem.

The frontend calls `/api`, and the Next.js server forwards those requests to the backend using Render's private `BACKEND_HOSTPORT`; browser requests therefore remain same-origin. If you attach a custom frontend domain, update `CORS_ORIGINS` and `FRONTEND_URL` to its exact HTTPS origin in the API service. Keep `NEXT_PUBLIC_API_URL` set to `/api` so requests continue through the proxy. For local development, the API allows `localhost:3000`, `127.0.0.1:3000`, and `localhost:5173` when `NODE_ENV` is not `production`. If you use a custom API domain directly instead of the proxy, revisit the cookie, CORS, and CSRF settings before deployment.

Add `PAYMENT_WEBHOOK_SECRET` if payment callbacks are enabled. Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` to enable email delivery. Set `CURRENT_SEMESTER`, `CURRENT_ACADEMIC_YEAR`, and registration-window variables when needed.

## Production notes

- The Blueprint uses Render's free web-service plan for initial deployment. Free services can spin down when idle; move both services to always-on plans for regular production use.
- Blueprint secrets declared with `sync: false` are requested only on initial Blueprint creation. Add or rotate secrets later in the Render Dashboard.
- Keep Atlas backups enabled, monitor `/api/health`, and test password reset, role-based access, and payment flows after deployment.
- Never commit `.env` files, database credentials, or production user data.