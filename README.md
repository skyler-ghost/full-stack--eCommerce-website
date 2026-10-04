# My E-Commerce web

Express + MongoDB backend with the existing HTML/CSS storefront wired to it.
Browsing is open to everyone. **Cart, checkout and orders require an account.**

## Run it
1. Install Node 18+ and MongoDB (or create a free MongoDB Atlas cluster).
2. Edit `config/config.env` (MONGO_URI, JWT_SECRET, ADMIN_EMAIL, ...).
3. Then:
   ```bash
   npm install
   npm run seed     # 16 products from your old script.js + an admin account
   npm run dev      # http://localhost:5000
   ```
Admin login: the ADMIN_EMAIL / SEED_ADMIN_PASSWORD from config.env, then open `/admin.html`. Change that password.

## Payments
- No `PAYSTACK_SECRET_KEY` and not production: demo mode, a button simulates a successful payment.
- With a key: real Paystack checkout. In the Paystack dashboard set the webhook to
  `https://YOUR-DOMAIN/api/payment/webhook`, and set CLIENT_URL to your site URL.
- In production (NODE_ENV=production) demo mode is disabled automatically.

## Email
Leave SMTP_* empty to print emails in the console. Fill them in to send real ones.

## Deploy
`render.yaml` and `Procfile` are included. Set the env vars from config.env on your host
(MONGO_URI, JWT_SECRET, CLIENT_URL, PAYSTACK_SECRET_KEY, SMTP_*, ADMIN_EMAIL, NODE_ENV=production).
Do not commit config/config.env.
