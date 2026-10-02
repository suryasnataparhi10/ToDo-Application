# SpendWise

A MERN expense tracker with JWT authentication, per user expenses, dashboard summaries, filters, and light and dark themes.

## Run locally

1. Copy `server/.env.example` to `server/.env` and set `MONGO_URI` and `JWT_SECRET`.
2. To enable password recovery emails, also set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optionally `SMTP_FROM` in `server/.env`.
3. Start the API with `cd server && npm install && npm run dev`.
4. Start the frontend with `cd client && npm install && npm run dev`.

Password reset links expire after 30 minutes and can be used once. The frontend defaults to `http://localhost:5173` for reset links; set `CLIENT_URL` to the deployed frontend origin when hosting the app.

Set `VITE_API_URL` in the client environment to override the default API origin (`http://localhost:5000/api`).

## Deploy the website

GitHub Pages hosts the frontend. The Express API needs a running web service, and MongoDB needs a cloud connection string; GitHub Pages cannot run the API process or database.

1. Push the project to the repository's `main` branch. `.gitignore` excludes `.env` files and local dependencies; do not commit credentials.
2. Create a MongoDB Atlas database and copy its connection string. In Render, create a Blueprint from this repository's `render.yaml`; set `MONGO_URI` to the Atlas connection string and `CLIENT_URL` to the full website URL, such as `https://<github-username>.github.io/<repository-name>`.
3. The Render API service uses the paid always-on `starter` plan so scheduled-message polling continues while the app is idle. Wait for Render to show the API as live and copy its URL.
4. In GitHub repository **Settings → Secrets and variables → Actions → Variables**, add `VITE_API_URL` with the API URL ending in `/api`, for example `https://spendwise-api.onrender.com/api`.
5. In **Settings → Pages**, select **GitHub Actions** as the publishing source. Run the **Deploy website to GitHub Pages** workflow from the Actions tab, or push another commit to `main`.
6. The workflow publishes the website at `https://<github-username>.github.io/<repository-name>`.
6. To enable scheduled email/SMS/WhatsApp delivery, add the relevant SMTP or Twilio environment variables to the Render API service. Keep these values in Render's environment settings, not in GitHub.

The frontend workflow is in `.github/workflows/deploy-website.yml`. Deep links are handled by the generated Pages `404.html` fallback. GitHub Actions variables and Pages publishing are documented by [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages); the backend Blueprint is described in [Render's Blueprint documentation](https://render.com/docs/blueprint-spec).

## Android and iOS app

The Expo React Native app lives in `mobile/` and connects to the same API. Set `EXPO_PUBLIC_API_URL` to the deployed API URL, then use Expo Go for development or EAS Build for an installable Android package. See `mobile/README.md` for setup and build instructions. Expo documents creating projects with [`create-expo-app`](https://docs.expo.dev/get-started/create-a-project/) and [internal Android/iOS builds](https://docs.expo.dev/build/internal-distribution/).

## Formatting

Run `npm run format` from `client` to format the frontend and backend JavaScript and CSS with the shared Prettier configuration. Run `npm run format:check` to check formatting.

## API

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`
- `GET /api/auth/me`
- `GET` and `POST /api/expenses`
- `POST /api/expenses/bulk`
- `GET`, `PUT`, and `DELETE /api/expenses/:id`
- `GET /api/expenses/yearly?year=`
- `GET /api/dashboard/summary?month=&year=`
