# Midnight Brew — QR ordering

*Good coffee. Late nights. Good vibes.* · [@midnightbrew.bkk](https://instagram.com/midnightbrew.bkk)

A link between customers and staff: **no payments happen in the app**. It handles orders, staff workflow and sales reports.

| URL | Who | What |
|---|---|---|
| `/` | Customers (via the single QR code) | Menu with prices, search, cart, name + note, place order, live order status |
| `/staff` | Staff (login required) | Active · Add items · Paid/Cancelled · Report · Menu on/off · QR code |

## How the staff side works

- **Active**: new QR orders show with a ringing alert, a flashing banner, a flashing tab title and a system notification. The alert repeats **until the order is opened**. Open an order and press **Take order**, then **Order paid**, then pick **QR / Cash / Card**. It moves to the report immediately. You can also **Cancel** an order or **Mark unpaid** (customer left).
- **Add items**: staff build their own order from the menu. You can add a **discount or extra charge** (as an amount or %), pick **QR / Cash / Card / GrabFood**, and charge it. It's recorded as paid right away.
- **Paid / Cancelled**: history by day, filterable by Paid / Cancelled / Unpaid, searchable by name or order number. Unpaid orders can still be marked paid later.
- **Report**: daily or monthly. Shows totals by payment method and by menu item, discounts and surcharges, cancelled and unpaid counts, and a day-by-day table for monthly reports. **Export JPG** downloads the report as an image. Use ‹ › to look at earlier days or months.
- **Menu on/off**: switch sold-out items off. Customers see "Sold out" instantly and can't order them.
- **QR code** (top bar): generates the one QR code for the site. Download it and print it.

> Alerts: on each staff device, press **Enable sound & notifications** once after logging in, because browsers block sound until someone taps the page. Keep the staff page open, on a tablet at the counter for example.

## Setup (one-time)

### 1. Supabase
1. Create a project at supabase.com.
2. **Database tables and menu are set up automatically.** In Supabase, open **Project Settings → Integrations → GitHub**, connect this repo, and switch on **Deploy to production** with production branch `main`. On every merge to `main`, Supabase applies any new files in `supabase/migrations/`. Each file runs once:
   - `…_schema.sql`: tables, security rules and order functions
   - `…_menu.sql`: the starting menu (only loads if the menu is empty, so your later edits are kept)

   *Without the integration:* open **SQL Editor → New query** and run each file in `supabase/migrations/` in name order. Both are safe to run again.
3. **Authentication → Users → Add user**: create a staff login (email + password, tick *Auto confirm*). Make one per staff member, or one shared login.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" so nobody else can create a staff account.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

### 1b. Or: do steps 2–4 with one command
Create the project (step 1), then on any computer with Node.js:
```bash
export SUPABASE_ACCESS_TOKEN=...   # supabase.com/dashboard/account/tokens
export SUPABASE_PROJECT_REF=...    # from https://<ref>.supabase.co
export STAFF_EMAIL=staff@example.com STAFF_PASSWORD='a-strong-password'
npm install && npm run setup:supabase
```
This runs the migrations (tables and starting menu), creates the staff login, turns off sign-ups, writes `.env.local`, and prints the two values for Vercel. Revoke the token afterwards.

### 2. Vercel
1. **Add New → Project**, then import this GitHub repo.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (values from step 1.5).
3. Deploy. Open `https://your-app.vercel.app/staff`, log in, press **QR code** and print it.

### Local development
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev                  # http://localhost:3000 and /staff
```

## Branding & menu: where to change things
| What | File |
|---|---|
| Name, tagline, Instagram, currency symbol | `lib/brand.ts` |
| Colors & fonts | top of `app/globals.css` (`:root` tokens) and the Google Fonts link in `app/layout.tsx` (Montserrat, Inter, Allura script, Noto Sans Thai) |
| Cat illustration | `components/Cat.tsx` |
| Logo / favicon | `public/logo.png` and `app/icon.png` (taken from the printed menu) |
| Menu items (name, Thai name, description, price, photo) | Supabase **Table Editor → menu_items** (live). The starting menu is in `supabase/migrations/…_menu.sql`. |
| Hot / Iced prices | `price_hot` and `price_iced` columns. Fill one or both and customers choose. Leave both empty to use the single `price`. |
| Category order | `CATEGORY_ORDER` in `lib/types.ts` |
| Food photos | `public/menu/*.jpg`, linked from `image_url` as `/menu/latte.jpg`. You can also upload a photo to Supabase Storage and paste its public URL. |

## Security notes
- Customers can only **read the menu** and **place orders** through the `place_order` database function. Prices are looked up on the server, so totals can't be tampered with. Customers can't see other people's orders.
- Everything else needs a staff login (Row Level Security).
- Days and months in reports follow the time zone of the device viewing them.

## Changing the database later
Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_changed.sql`. Never edit a migration that has already run. Merge it to `main` and Supabase applies it.
