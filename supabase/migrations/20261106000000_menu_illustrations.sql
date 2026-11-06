-- Line-art pictures for the menu items that had no photo.
-- Only fills items that still have no picture, so photos set in Supabase are kept.
update public.menu_items m
set image_url = v.url
from (values
  ('Cappuccino',        '/menu/cappuccino.svg'),
  ('Americano Yuzu',    '/menu/americano-yuzu.svg'),
  ('Coconut Americano', '/menu/coconut-americano.svg'),
  ('Lemon Soda',        '/menu/lemon-soda.svg'),
  ('8 Coffee',          '/menu/eight-coffee.svg'),
  ('Hash Browns',       '/menu/hash-browns.svg'),
  ('Oat Milk',          '/menu/oat-milk.svg'),
  ('Extra Shot',        '/menu/extra-shot.svg')
) as v(name, url)
where m.name = v.name and m.image_url is null;
