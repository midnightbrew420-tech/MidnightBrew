# Midnight Brew — QR ordering

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
2. **SQL Editor → New query**: paste `supabase/schema.sql` and **Run**. Then do the same with `supabase/seed.sql` (the menu).
3. **Authentication → Users → Add user**: create a staff login (email + password, tick *Auto confirm*). Make one per staff member, or one shared login.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" so nobody else can create a staff account.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

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
| Name, tagline, currency symbol | `lib/brand.ts` |
| Colors & fonts | top of `app/globals.css` (`:root` tokens) and the Google Fonts link in `app/layout.tsx` |
| Logo / favicon | `public/logo.svg` and `app/icon.svg` |
| Menu items (name, description, price, category, photo) | `supabase/seed.sql`, or edit directly in Supabase **Table Editor → menu_items** |
| Category order | `CATEGORY_ORDER` in `lib/types.ts` |
| Food photos | put files in `public/menu/` and set `image_url` to `/menu/latte.jpg`, or upload to Supabase Storage and paste the public URL |

## Security notes
- Customers can only **read the menu** and **place orders** through the `place_order` database function. Prices are looked up on the server, so totals can't be tampered with. Customers can't see other people's orders.
- Everything else needs a staff login (Row Level Security).
- Days and months in reports follow the time zone of the device viewing them.
