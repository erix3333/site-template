# Project Handoff — Phase 1 ✅
_Last updated: 2025-10-07T19:02:41.443613Z_

This document captures everything needed to continue the store project in a new chat or by a new contributor.

---

## 1) What we built
- **Static storefront** (HTML/CSS/JS) deployed on **Vercel** (no build step).
- **Serverless endpoints**
  - `GET /api/catalog` → serves `products.json` (catalog).
  - `POST /api/create-checkout-session` → creates a Stripe Checkout Session, using prices from `products.json`.
- **Admin utility**: `/pages/admin.html` to load/edit the catalog and **download** an updated `products.json` (manual commit).
- **Checkout**: Multi-step form (Info → Shipping → Payment → Review) that reads catalog via `/api/catalog` and redirects to Stripe.

## 2) Files & responsibilities
```
/index.html               # Home/product grid; pulls products via /api/catalog (through app.js)
/app.js                   # Frontend helpers (cart, money fmt, loadProducts)
/styles.css               # Global styles
/products.json            # Catalog source of truth (id, title, price, currency, image, category, excerpt, description, stripePrice)

/pages/checkout.html      # 4-step checkout; totals; POST to Stripe API
/pages/admin.html         # Catalog editor; Load/Validate/Export+Save (download)

/api/catalog.js           # Reads products.json, returns JSON
/api/create-checkout-session.js  # Stripe checkout session creation
/vercel.json              # Static + API routing; CORS headers for API
```

## 3) Required environment variables (Vercel → Project → Settings → Environment Variables)
- `STRIPE_SECRET_KEY` → your Stripe secret key (test/live as needed).

## 4) Key URLs (adjust to your deployment)
- Storefront: `https://<your-deployment>/`
- Admin: `https://<your-deployment>/pages/admin.html`
- Checkout: `https://<your-deployment>/pages/checkout.html`
- Catalog API: `https://<your-deployment>/api/catalog`
- Stripe session API: `https://<your-deployment>/api/create-checkout-session`

## 5) Admin workflow
1. Open **Admin** → click **Load** (pulls current `products.json`).
2. Add/edit rows → **Validate**. (IDs must be unique, prices ≥ 0; `stripePrice` optional but if present must begin with `price_`.)
3. Click **Save** → will try to call `/api/admin/save-catalog` (not implemented by default). It then **downloads `products.json`** as fallback.
4. Commit the downloaded `products.json` to the repo root. Deploy via Vercel → products show on Home & Checkout.

> _No secret UI is shown; the admin operates offline by downloading JSON. If you later add a write API, secure with the `x-admin-token` header and Vercel env._

## 6) Routing & CORS (vercel.json)
- Static routes for HTML/CSS/JS/images/products.json
- API rewrites for `/api/*`
- CORS headers for API endpoints (including `x-admin-token` header if you later enable write access).

## 7) Stripe notes
- Uses **Stripe Checkout** (Payment Links via API).
- Shipping computed in serverless function with two options (Standard/Express) and a free threshold.
- Success URL: `/pages/thank-you.html`
- Cancel URL: `/pages/cancel.html`

## 8) Known-good test steps
- Add products in **Admin** → download+commit `products.json`.
- Visit **Home** → products render.
- Add to cart → open **Checkout** → products and totals render.
- Submit → Stripe test mode (e.g., `4242 4242 4242 4242`, any future date, any CVC, any ZIP) → success → thank-you.

## 9) Common pitfalls & fixes
- **404 on /api/catalog** → `api/catalog.js` missing or vercel.json misrouting. Ensure both exist and deploy succeeded.
- **Products don’t show** → stale `products.json` (didn’t commit), JSON invalid, or network blocked. Check DevTools → Network.
- **Vercel “No Output Directory named public”** → Make sure Project Settings → Build & Output says “No build command” or is overridden; we are static.
- **Prices mismatch** → `products.json` is source of truth for frontend **and** backend session builder.

## 10) Phase 2 plan (design & UX)
- Build a small **design system**: color tokens, typography scale, spacing, shadows, radii.
- Add **themes** (light/dark + brand color) with CSS vars.
- Refactor **components**: header, product cards, badges, hero, inputs, radio cards, stepper, summary card, buttons.
- Polish **a11y** & responsive layout.
- Optional: product detail page; collection filters; nicer empty-states; toast messages.
- Keep Admin and Stripe flows intact.

---

### Handoff tips
- Upload this file to the repo as `PHASE1_HANDOFF.md` for easy reference.
- In a new Chat, share your latest ZIP; we’ll start by applying the design system and themeing across pages.
