-- =====================================================================
-- New poster photos, and two new Italian sodas from the posters.
--   * Blueberry Soda and Coconut Soda (75 THB), added once by name.
--   * Items that still show a line drawing get their new poster photo.
-- Photos set in Supabase (anything not one of the shipped drawings) are kept.
-- Safe to re-run.
-- =====================================================================

insert into public.menu_items (category, sort_order, name, description, price, image_url)
select v.category, v.sort_order, v.name, v.description, v.price, v.image_url
from (values
  ('Italian Soda', 70, 'Blueberry Soda', 'Sparkling blueberry soda with a hint of sweetness. Fresh and fizzy.', 75, '/menu/blueberry-soda.jpg'),
  ('Italian Soda', 80, 'Coconut Soda',   'Sparkling coconut soda. Tropical and refreshing.',                     75, '/menu/coconut-soda.jpg')
) as v(category, sort_order, name, description, price, image_url)
where not exists (select 1 from public.menu_items m where lower(m.name) = lower(v.name));

update public.menu_items m
set image_url = v.photo
from (values
  ('/menu/cappuccino.svg',        '/menu/cappuccino.jpg'),
  ('/menu/americano-yuzu.svg',    '/menu/americano-yuzu.jpg'),
  ('/menu/coconut-americano.svg', '/menu/coconut-americano.jpg'),
  ('/menu/lemon-soda.svg',        '/menu/lemon-soda.jpg')
) as v(drawing, photo)
where m.image_url = v.drawing;
