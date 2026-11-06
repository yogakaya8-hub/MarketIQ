# Multi-Vendor E-Commerce Platform with Smart Marketplace Intelligence

A working multi-vendor marketplace (shop name in the UI: **Bazaario**) with three intelligence features on top of the usual catalogue, cart and order flow:

| Feature | Problem it solves | Where to see it |
|---|---|---|
| **Reverse Marketplace** | Customers know what they need but can't find a seller | Customer: *Post a requirement*, then compare offers. Vendor: *Requirement board* |
| **Dead Stock Rescue** | Vendors hold stock that stays unsold | Vendor: *Dead stock alerts* and *Rescue deals*. Public: */deals* |
| **Failed Purchase Learning** | Shoppers view and add to cart, then leave | Vendor/Admin: *Purchase drop-off* |

Everything runs on real data stored in MongoDB. Nothing on the dashboards is hard-coded.

**Stack:** React 18 + Vite, Tailwind CSS, React Router, Axios, Recharts, Lucide React · Node.js + Express · MongoDB + Mongoose · JWT + bcrypt.

---

## 1. Quick start

**Prerequisites:** Node.js 18 or newer, and MongoDB 6+ running locally (or a MongoDB Atlas connection string).

```bash
# 1. Install everything (root, backend, frontend)
npm run install:all

# 2. Configure the API
cp backend/.env.example backend/.env       # edit MONGODB_URI / JWT_SECRET if needed

# 3. Load realistic demo data (drops and recreates the database)
npm run seed

# 4. Start API (port 5000) and web app (port 5173) together
npm run dev
```

Open **http://localhost:5173**. The Vite dev server forwards `/api` calls to the Express server.

Other commands: `npm test` (backend test suite) and `npm run build` (production build of the frontend into `frontend/dist`).

### Demo accounts (created by the seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@marketplace.test | Admin@123 |
| Vendor | technest@marketplace.test (also `urbanthread`, `homecraft`, `fitzone`, `pageturner`) | Vendor@123 |
| Vendor awaiting approval | greenleaf@marketplace.test | Vendor@123 |
| Customer | priya@marketplace.test (also `arjun`, `kavya`, `rahul`, `sneha`, `vikram`, `ananya`, `karthik`) | Customer@123 |
| Suspended customer | rohan@marketplace.test | Customer@123 |

The login page also has one-click buttons that fill these in.

### What the seed creates

About six months of consistent history: 43 products with different sales patterns, about 750 orders, about 10,000 purchase events, carts that match each shopper's last cart action, requirements in every state (open, awarded, expired, cancelled) with offers, active and expired rescue deals, and reported issues. It then runs the real dead-stock analysis, so alerts and insights are produced by the same code the app uses. The seed is deterministic, so every run produces the same data.

---

## 2. Suggested demo walkthrough (about 10 minutes)

1. **Customer (priya):** browse, open a product (this records a view), add to cart, remove an item and pick a reason, then check out. One checkout creates one order per store.
2. **Customer (priya):** *My requirements* → "Insulated steel water bottles". Compare the two offers on price, budget, delivery date and the seller's track record, then **Select this offer**. An order is created and the other offer is declined.
3. **Customer (sneha):** *Post a requirement*. Vendors in that category are notified.
4. **Vendor (pageturner):** *Requirement board* → open the new requirement → send an offer, optionally linked to a catalogue product so stock is reserved on acceptance.
5. **Vendor (technest):** *Dead stock alerts*. Each product shows its classification, the evidence and suggested actions. **Create rescue deal** on a flagged product; it appears on the public */deals* page.
6. **Vendor (technest):** *Purchase drop-off*. See the funnel, daily activity, and insights where *Observed* facts are kept separate from *Inferred* abandonment and from reasons customers actually gave.
7. **Vendor (fitzone):** *Orders* → confirm and ship the order created from the requirement.
8. **Admin:** approve GreenLeaf Organics (its products only appear after approval), suspend a user, hide a product, answer a reported issue, change thresholds in *Thresholds*, and review *System activity*.

Screenshots of the main screens are in [`docs/screenshots`](docs/screenshots). They map one-to-one to the "Screenshots / Demo" slide of the project review deck.

---

## 3. Project structure

```
smart-marketplace/
├── package.json                 # root scripts: install:all, seed, dev, test, build
├── backend/
│   ├── src/
│   │   ├── server.js            # connects DB, starts API and background jobs
│   │   ├── app.js               # express app: helmet, cors, json, routes, errors
│   │   ├── jobs.js              # deal/requirement expiry (1 min), inventory analysis (6 h)
│   │   ├── config/              # env, db connection, constants (roles, statuses, categories)
│   │   ├── models/              # Mongoose schemas (one file per collection)
│   │   ├── middleware/          # auth (protect, authorize, requireApprovedVendor), validate, errors
│   │   ├── validators/          # zod request schemas
│   │   ├── controllers/         # HTTP layer: parse request, call services, shape response
│   │   ├── services/            # business logic
│   │   │   ├── reverseMarketplaceService.js   # Feature A
│   │   │   ├── deadStockService.js            # Feature B (classification + insights)
│   │   │   ├── rescueDealService.js           # Feature B (deals)
│   │   │   ├── purchaseAnalyticsService.js    # Feature C
│   │   │   ├── trackingService.js             # event recording and de-duplication
│   │   │   ├── orderService.js                # atomic stock, checkout, cancellation
│   │   │   ├── pricingService.js              # effective price and deal expiry
│   │   │   └── salesAnalyticsService.js, notificationService.js, activityService.js
│   │   ├── routes/index.js      # every endpoint with its role guard
│   │   └── seed/seed.js
│   └── tests/                   # node:test + supertest against a real MongoDB
└── frontend/
    └── src/
        ├── api/client.js        # axios instance + token handling
        ├── context/             # Auth, Cart, Toast providers
        ├── components/          # layouts, route guard, shared UI, product artwork
        ├── lib/                 # formatting, constants, chart tokens, data hook
        └── pages/
            ├── public/          # home, catalogue, product, deals, stores, login, register
            ├── customer/        # cart, checkout, orders, requirements, offer comparison
            ├── vendor/          # dashboard, products, orders, requirement board, offers, deals
            ├── admin/           # dashboard, users, vendors, products, orders, reports, activity, thresholds
            └── shared/          # order detail, notifications, reports, inventory intelligence, drop-off insights
```

### Database collections (matches the ER design in the deck)

`users`, `vendors` (store profile, 1:1 with a vendor user), `products`, `carts`, `orders` (order items are embedded sub-documents), `requirements`, `offers`, `purchaseevents`, `inventoryinsights`, `rescuedeals`, `analytics` (monthly vendor sales summary), plus `notifications`, `reports`, `activitylogs` and `settings` (admin-configurable thresholds).

---

## 4. How the three features work

### A. Reverse Marketplace

1. A customer posts a requirement: description, category, quantity, **total budget** and **required-by date** (inclusive, must be today or later and within a year).
2. Approved vendors whose store categories include it are notified. The *Requirement board* shows open requirements, filtered to the vendor's categories by default. Vendors see the buyer's first name and city only, and never see other vendors' prices.
3. A vendor submits **one** offer per requirement (unique index on requirement + vendor) with a total price, delivery days and notes, and can optionally link a catalogue product. They can revise or withdraw it while it is pending.
4. Offers are rejected if the price is not positive, the delivery would arrive after the required date, the linked product isn't theirs or lacks stock, the requirement is closed or expired, or the store isn't approved.
5. The customer sees a side-by-side comparison: total and unit price, difference against budget, delivery date, whether it arrives in time, the seller's delivered/total orders, and tags for *Lowest price* and *Fastest delivery*.
6. **Selecting an offer** is protected against races without needing a replica set. The requirement is claimed with a conditional atomic update (`status: 'open'` → `'awarded'`), then the offer (`'pending'` → `'accepted'`). Linked stock is reserved atomically and the order is created. If any step fails, the earlier steps are undone. Other pending offers become *Not selected* and their vendors are notified. A test fires three selections in parallel and checks that exactly one wins.

### B. Dead Stock Rescue

For every product the analysis reads **actual non-cancelled orders**, not just counters:

* `idleDays` = days since the last sale, or days since listing if it never sold
* `unitsInWindow` = units sold in the last *N* days (default 90), giving a daily sales rate
* `daysOfCover` = current stock ÷ daily sales rate

| Rule | Result |
|---|---|
| Listed for less than `minObservationDays` (21) | **Insufficient data**. No classification is guessed |
| Stock is 0 | Healthy. Nothing is at risk |
| idleDays ≥ 90 | **Potential dead stock** |
| idleDays ≥ 60, or daysOfCover ≥ 240 | **At-risk** |
| idleDays ≥ 30, or daysOfCover ≥ 120 | **Slow-moving** |
| otherwise | **Healthy** |

High stock **alone never triggers a flag**. The cover rule only applies when there were recent sales to measure, and a dead-stock classification always needs time without sales. Every threshold is editable by the admin, with validation that keeps them in order.

Each result shows the evidence in plain sentences, suggested actions (scaled to severity), and cross-feature hints: "viewed 26 times recently without buying" (from purchase events) and "1 open customer requirement in this category" (from the reverse marketplace). Results are saved as `InventoryInsight` snapshots. A vendor gets **one** notification when a product newly becomes at-risk or dead stock, not one on every refresh. Analysis runs on demand and every 6 hours.

**Rescue deals:** the server re-runs the analysis before allowing a deal, so only slow-moving, at-risk or dead-stock products qualify. Discount (default 5–70%) and duration (max 30 days) are validated, and a partial unique index allows only one active deal per product. **The base price is never overwritten.** The effective price is calculated at read time and again at checkout. Expired deals stop applying immediately, because every price lookup sweeps expired deals and a background job also sweeps every minute. If a vendor edits the base price during a deal, the deal price is recalculated. Units sold and revenue recovered are tracked per deal.

### C. Failed Purchase Learning

**Events tracked** (`purchaseevents`): `product_viewed`, `added_to_cart`, `cart_quantity_changed`, `cart_item_removed`, `checkout_initiated`, `purchase_completed`. Each event stores user (or anonymous session), product, vendor, quantity and timestamp.

**Avoiding spoofing and double counting:**

* The browser may only report `product_viewed`. Every other event is written by the server at the moment the real action happens (cart API, checkout, order creation).
* Repeat views by the same shopper within 30 minutes count once. Views by the product's own vendor or by admins are ignored.
* `checkout_initiated` is also de-duplicated. When an order is cancelled, its purchase events are flagged and excluded.

**Definitions** (also shown in the app under *How it is measured*). Conversions are **cohort-based** per shopper and product pair, so they can never exceed 100%:

* *View conversion* = shoppers who bought **after** their first view ÷ shoppers who viewed
* *Cart conversion* = shoppers who bought after adding ÷ shoppers who added
* *Checkout conversion* = shoppers who completed after starting checkout ÷ shoppers who started
* **Observed** removal: the shopper removed the item. **Inferred** abandonment: the shopper added it, did not remove it, did not buy afterwards, and has been inactive for more than 24 hours. Activity inside that grace period is reported as "too recent to judge", not as abandonment.
* **Reasons are never invented.** When removing an item, the customer *may* choose a reason, and only those stated reasons are shown. Insights list "possible factors to review, not confirmed causes".

Insight rules (thresholds are configurable): high views with low view conversion, added to cart but not bought, drop-off at checkout, and frequently removed from cart. Example of generated text:

> *Observed:* Mechanical Keyboard (Blue Switch) received 100 views and 30 add-to-cart events but only 5 completed purchases in the last 30 days.
> *Inferred:* 5 carts have had no activity for over 24 hours without a purchase.
> *Said:* Customers who removed it chose "Delivery takes too long" (5), "Found a better price elsewhere" (3).

---

## 5. Security and data integrity

* Passwords are hashed with bcrypt (12 rounds) and never returned. JWT auth uses `Authorization: Bearer <token>`.
* **Authorization is enforced on the server.** Each route has a role guard, ownership is checked in the services, and roles are read from the database on every request, not trusted from the token. Suspended users are blocked immediately. Vendors cannot touch other vendors' products, orders or offers, and customers cannot read other customers' orders (the API returns 404, not 403, so it doesn't reveal that the order exists).
* Vendors must be **approved** before listing products or sending offers. Products of unapproved stores are hidden everywhere public.
* Inputs are validated with zod. Prices are always computed on the server, so a client-sent price or total is ignored.
* **No overselling:** stock is decremented with a conditional atomic update (`stock >= qty`) per line, with automatic release if any line or the order insert fails. A test runs four simultaneous checkouts for the last unit and checks that exactly one succeeds.
* Order status follows an allowed workflow (placed → confirmed → shipped → delivered; cancel only before shipping). Cancelling restores stock and the sales counters.
* `helmet`, CORS limited to the client URL, rate limiting on login and registration, a 200 KB request body limit, and regex-escaped search input.

---

## 6. API reference (main endpoints)

All endpoints are under `/api`. 🔓 public · 👤 customer · 🏪 vendor (✅ = approved store required) · 🛡 admin

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | /auth/register, /auth/login | 🔓 | Create account (customer or vendor) / sign in |
| GET, PUT | /auth/me | any | Current user / update profile and address |
| GET | /products, /products/:id, /products/categories | 🔓 | Search, filter, sort, paginate; detail with vendor info |
| POST | /products/:id/events | 🔓 | Record a product view (only `product_viewed` accepted) |
| POST, PUT, DELETE | /products, /products/:id | 🏪✅ / 🏪 | Manage own catalogue (delete archives the product) |
| GET, POST, PATCH, DELETE | /cart, /cart/items, /cart/items/:productId | 👤 | Cart. Removal accepts an optional `reason` |
| POST | /cart/checkout-intent | 👤 | Records `checkout_initiated` |
| POST | /orders | 👤 | Place order from cart (one order per vendor) |
| GET | /orders/my · /orders/vendor · /orders | 👤 · 🏪 · 🛡 | Order lists |
| PATCH / POST | /orders/:id/status · /orders/:id/cancel | 🏪🛡 · all parties | Fulfilment workflow / cancel |
| POST / GET | /requirements | 👤 / role-aware | Post a requirement / list (customer: own, vendor: board, admin: all) |
| GET | /requirements/:id | role-aware | Customer gets the offer comparison; vendor gets their own offer |
| POST | /offers | 🏪✅ | Submit an offer |
| PUT | /offers/:id | 👤 / 🏪 | `{action: "select"}` by the customer, `"update"` / `"withdraw"` by the vendor |
| GET | /inventory/dead-stock | 🏪 🛡 | Run the analysis and get classifications, evidence and actions |
| GET / POST | /rescue-deals | 🔓 / 🏪✅ | Active public deals / create a deal |
| GET | /analytics/purchase-dropoff?days=30 | 🏪 🛡 | Funnel, insights, daily series, definitions |
| GET | /analytics/vendor-summary · /analytics/platform | 🏪 · 🛡 | Dashboards |
| GET, PATCH | /notifications, /notifications/:id/read | any | Notifications |
| POST / GET | /reports, /reports/mine | 👤🏪 | Report an issue |
| GET, PATCH, PUT | /admin/users, /admin/vendors, /admin/products, /admin/reports, /admin/activity, /admin/settings | 🛡 | Administration and thresholds |

---

## 7. Tests

`npm test` runs 25 integration and unit tests (Node's built-in test runner plus supertest) against a real MongoDB database named `smart_marketplace_test`, which is separate from the dev data. Set `MONGODB_URI_TEST` to override it. The tests cover:

* auth and RBAC (hashing, duplicate email, no self-registration as admin, suspended accounts, role and ownership checks, pending vendors, hidden stores)
* orders (split per vendor, server-side pricing, concurrent oversell race, status workflow, cancellation restoring stock)
* reverse marketplace (validation, duplicate and late offers, comparison data, masking, unauthorized selection, parallel selection race, revise and withdraw)
* dead stock (classification rules including the "high stock alone" case, real-order analysis, de-duplicated alerts, rescue deal eligibility, effective pricing, expiry)
* drop-off analytics (view de-duplication, spoofed events, cohort conversions, observed vs inferred, cancelled purchases excluded, generated insight text)

---

## 8. Known limitations (be upfront in the review)

* **Payments are simulated.** "Online payment (demo)" stores the choice but charges nothing.
* **No multi-document transactions.** Consistency comes from conditional atomic updates with compensation, which works on a standalone MongoDB. On a replica set or Atlas, wrapping checkout in a transaction would be a natural upgrade.
* **Product images** are optional URLs. Without one, the UI shows generated category artwork. There is no file upload.
* **Background jobs** run inside the API process (`setInterval`). In production these would move to a job queue or scheduler.
* Anonymous views cannot be linked to a later signed-in purchase, so view conversion is slightly conservative.
* Suggested actions and insights are rule-based, not machine learning. That is deliberate: every alert can be explained from the data shown next to it.

## 9. Future scope (extends the three features, as in the deck)

Predictive demand forecasting from requirement history · automated market-gap detection (frequently requested, unavailable products) · auto-matching requirements to suitable vendors · discount and bundle recommendations learned from past rescue-deal results · richer drop-off reasons from optional exit surveys · a combined marketplace health view.
