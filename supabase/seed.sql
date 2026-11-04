-- =====================================================================
-- Midnight Brew — menu (from the physical menu)
-- price_hot / price_iced: set one or both for drinks with Hot/Ice prices.
-- price: the single price for items without Hot/Ice (and the lowest price
--        otherwise). Photos live in /public/menu/.
-- Re-running this file wipes and reloads the menu (orders are kept).
-- =====================================================================

delete from public.menu_items;

insert into public.menu_items
  (category, sort_order, name, name_th, description, price, price_hot, price_iced, image_url)
values
  -- COFFEE
  ('Coffee', 10, 'Espresso',          null, 'A bold double shot of our house blend.',                       50,  50,  60, '/menu/espresso.jpg'),
  ('Coffee', 20, 'Americano',         null, 'Espresso lengthened with water. Clean and strong.',            45,  45,  55, '/menu/americano.jpg'),
  ('Coffee', 30, 'Mocha',             null, 'Espresso, chocolate and milk.',                                60,  60,  65, '/menu/mocha.jpg'),
  ('Coffee', 40, 'Latte',             null, 'Espresso with smooth, creamy milk.',                           55,  55,  65, '/menu/latte.jpg'),
  ('Coffee', 50, 'Cappuccino',        null, 'Espresso, steamed milk and a thick layer of foam.',            55,  55,  65, null),
  ('Coffee', 60, 'Vanilla Latte',     null, 'Our latte sweetened with vanilla.',                            65,  65,  75, '/menu/vanilla-latte.jpg'),
  ('Coffee', 70, 'Americano Yuzu',    null, 'Americano with bright, citrusy yuzu.',                         85, null, null, null),
  ('Coffee', 80, 'Americano Orange',  null, 'Americano with fresh orange.',                                 85, null, null, null),
  ('Coffee', 90, 'Coconut Americano', null, 'Americano with coconut water.',                               85, null, null, null),

  -- NON-COFFEE
  ('Non-Coffee', 10, 'Cocoa',          'โกโก้',        'Rich, chocolatey cocoa.',                                  65,  65,  75, '/menu/cocoa.jpg'),
  ('Non-Coffee', 20, 'Matcha Latte',   'มัทฉะลาเต้',    'Matcha whisked into fresh milk.',                         90,  90, 100, '/menu/matcha-latte.jpg'),
  ('Non-Coffee', 30, 'Pure Matcha',    'เพียวมัทฉะ',    'Straight matcha green tea. Rich in antioxidants.',          75,  75,  85, '/menu/pure-matcha.jpg'),
  ('Non-Coffee', 40, 'Coconut Matcha', 'มัทฉะมะพร้าว',  'Matcha layered over coconut water.',                     100, null, 100, '/menu/coconut-matcha.jpg'),
  ('Non-Coffee', 50, 'Thai Tea',       'ชาไทย',        'Classic Thai milk tea.',                                    50,  50,  60, '/menu/thai-tea.jpg'),
  ('Non-Coffee', 60, 'Honey Lemon',    'ชาเลมอน',      'Lemon tea with honey.',                                    50,  50,  60, '/menu/honey-lemon.jpg'),

  -- ITALIAN SODA
  ('Italian Soda', 10, 'Lychee Soda',      null, 'Sparkling lychee soda with rosemary.',                75, null, null, '/menu/lychee-soda.jpg'),
  ('Italian Soda', 20, 'Lemon Soda',       null, 'Sparkling lemon soda.',                              75, null, null, null),
  ('Italian Soda', 30, 'Plum Soda',        null, 'Sparkling soda with sweet-tart plum.',               75, null, null, '/menu/plum-soda.jpg'),
  ('Italian Soda', 40, 'Strawberry Soda',  null, 'Sparkling strawberry soda.',                         75, null, null, '/menu/strawberry-soda.jpg'),
  ('Italian Soda', 50, 'Yuzu Soda',        null, 'Sparkling soda with Japanese yuzu citrus.',          75, null, null, '/menu/yuzu-soda.jpg'),
  ('Italian Soda', 60, 'Honey Lemon Soda', null, 'Sparkling lemon soda with honey.',                   75, null, null, '/menu/honey-lemon-soda.jpg'),

  -- SPECIAL
  ('Special', 10, 'Caramel Macchiato', null,                         'Milk, espresso and a caramel drizzle.',            75, 75, 85, '/menu/caramel-macchiato.jpg'),
  ('Special', 20, 'Salted Caramel',    null,                         'Coffee with salted caramel and milk.',             75, 75, 85, '/menu/salted-caramel.jpg'),
  ('Special', 30, '8 Coffee',          'กาแฟผสมชาไทยสูตรทางร้าน',        'Coffee blended with Thai tea. Our house recipe.',   75, 75, 85, null),
  ('Special', 40, '8 Time',            'กาแฟผสมชาเขียวมัทฉะ สูตรร้าน',     'Coffee blended with matcha. Our house recipe.',    75, 75, 85, '/menu/eight-time.jpg'),

  -- SNACKS
  ('Snacks', 10, 'Pork Gyoza',      null, 'Pan-fried pork dumplings with dipping sauce.', 90, null, null, '/menu/pork-gyoza.jpg'),
  ('Snacks', 20, 'Popcorn Chicken', null, 'Crispy bite-size fried chicken.',              90, null, null, '/menu/popcorn-chicken.jpg'),
  ('Snacks', 30, 'Hash Browns',     null, 'Golden, crispy potato hash browns.',           80, null, null, null),
  ('Snacks', 40, 'French Fries',    null, 'Crispy golden fries.',                         80, null, null, '/menu/french-fries.jpg'),

  -- EXTRA
  ('Extra', 10, 'Oat Milk',    null, 'Swap to oat milk in any drink.', 20, null, null, null),
  ('Extra', 20, 'Extra Shot',  null, 'Add an extra espresso shot.',    20, null, null, null);
