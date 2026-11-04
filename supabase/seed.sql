-- =====================================================================
-- Midnight Brew — menu seed
-- SAMPLE ITEMS: replace names / descriptions / prices / images with the
-- real physical menu. Images can be put in /public/menu/ (e.g.
-- /menu/latte.jpg) or uploaded to Supabase Storage (paste the public URL).
-- Re-running this file wipes and reloads the menu (orders are kept).
-- =====================================================================

delete from public.menu_items;

insert into public.menu_items (category, name, description, price, image_url, sort_order) values
  -- Coffee
  ('Coffee',     'Espresso',            'A short, intense double shot of our house blend.',                 60,  null, 10),
  ('Coffee',     'Americano',           'Double espresso stretched with hot water. Clean and bold.',        70,  null, 20),
  ('Coffee',     'Café Latte',          'Espresso with silky steamed milk and a thin layer of foam.',      85,  null, 30),
  ('Coffee',     'Cappuccino',          'Equal parts espresso, steamed milk and velvety foam.',             85,  null, 40),
  ('Coffee',     'Midnight Mocha',      'Espresso, dark chocolate and milk, topped with cocoa.',            95,  null, 50),
  ('Coffee',     'Iced Caramel Latte',  'Chilled latte with house caramel over ice.',                       95,  null, 60),
  -- Non-Coffee
  ('Non-Coffee', 'Matcha Latte',        'Ceremonial-grade matcha whisked with steamed or iced milk.',       95,  null, 10),
  ('Non-Coffee', 'Dark Chocolate',      'Rich hot chocolate made with 70% dark cocoa.',                     85,  null, 20),
  ('Non-Coffee', 'Thai Milk Tea',       'Strong black tea, condensed milk, served over ice.',               75,  null, 30),
  ('Non-Coffee', 'Honey Lemon Soda',    'Sparkling soda with fresh lemon and wild honey.',                  70,  null, 40),
  -- Food
  ('Food',       'Butter Croissant',    'Flaky, all-butter croissant, warmed to order.',                    65,  null, 10),
  ('Food',       'Ham & Cheese Toastie','Smoked ham and melted cheddar on toasted sourdough.',             120,  null, 20),
  ('Food',       'Truffle Fries',       'Crispy fries tossed with truffle oil and parmesan.',              110,  null, 30),
  ('Food',       'Chicken Pesto Pasta', 'Spaghetti in basil pesto with grilled chicken.',                  165,  null, 40),
  -- Dessert
  ('Dessert',    'Basque Cheesecake',   'Burnt-top cheesecake with a creamy centre.',                      120,  null, 10),
  ('Dessert',    'Brownie à la Mode',   'Warm fudge brownie with a scoop of vanilla ice cream.',           110,  null, 20);
