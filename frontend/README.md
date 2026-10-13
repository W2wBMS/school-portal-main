# Student Portal

Student Portal is a full-stack application with a Next.js frontend and an Express API backed by MongoDB.

## Requirements

- Node.js (with npm)
- MongoDB, either a local server or a MongoDB Atlas cluster
- The dependencies installed in the project (run `npm run install:all` from this directory if needed)

## Configure the backend

The API reads its settings from `backend/.env`. Copy `backend/.env.example` to `backend/.env` if the file does not exist, then set `MONGO_URI` to your local MongoDB connection string or Atlas URI. Set a private `JWT_SECRET` for local use as well. The checked-in example URI is a placeholder and cannot connect until replaced. Keep `.env` files private and do not commit them.

The frontend defaults to the local API at `http://localhost:5000/api`, so no frontend environment file is needed for local development. To use another API, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to its API base URL.

## Run the application

From the repository root (`PORTAL`), start both the backend and frontend:

```bash
npm run dev
```

The API connects to MongoDB before starting. Once both services are ready, open:

- Frontend: <http://localhost:3000>
- API health check: <http://localhost:5000/api/health>

Keep the terminal open while developing. Press `Ctrl+C` to stop the services.

To start only one service, use separate terminals from the repository root:

```bash
npm run backend
npm run frontend
```

## Other commands

```bash
npm run install:all                 # install backend and frontend dependencies
npm --prefix frontend run build     # build the frontend for production
npm --prefix frontend start         # serve the production frontend (build first)
npm --prefix backend start          # run the API without nodemon
npm --prefix backend test           # run backend tests
```

The production API also requires `backend/.env` to contain a reachable MongoDB URI and a strong `JWT_SECRET`. Set `NEXT_PUBLIC_API_URL` to the deployed API base URL before building the frontend.
