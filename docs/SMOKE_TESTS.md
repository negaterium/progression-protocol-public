# Smoke tests

These checks validate a fresh application deployment with synthetic data. Run
them against a disposable PostgreSQL database or a local development instance;
never use a production player account.

## Before you start

1. Follow [SETUP.md](SETUP.md) to create the environment file and initialize an
   empty PostgreSQL database.
2. Provision a disposable account with `npm run db:create-user`. Enter the
   password at the prompt instead of placing it in a command or file.
3. Start the application with `npm run dev` and open the printed local URL.

## Browser flow

1. Sign in with the disposable account and confirm the dashboard loads.
2. Open About and confirm the project description, fan-project disclaimer,
   author name, and resource links are visible.
3. Open Profile, Skills, Quests, Bosses and Habits; each page should render
   without redirecting back to login.
4. Open Inventory and Store separately. Confirm the store tab, item search and
   inventory view retain their selected state after navigation.
5. Accept or complete one disposable quest, reload, and confirm the result is
   persisted. Do not use a quest that affects a real account.
6. Sign out, then request the dashboard again and confirm it redirects to login.

## Automated checks

Run the repository checks before reporting a release candidate:

```sh
npm ci
npm test
npm run typecheck
npm run assets:verify
npm run package:check
npm run audit:production
```

The clean Docker/PostgreSQL rehearsal is run with `npm run setup:verify` on a
host where the Docker engine is available.
