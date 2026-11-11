-- Pictures for 8 Coffee, Hash Browns, Oat Milk and Extra Shot, replacing their line drawings.
-- Only items still showing the shipped drawing change, so photos set in Supabase are kept.
-- Safe to re-run.
update public.menu_items m
set image_url = v.photo
from (values
  ('/menu/eight-coffee.svg', '/menu/eight-coffee.jpg'),
  ('/menu/hash-browns.svg',  '/menu/hash-browns.jpg'),
  ('/menu/oat-milk.svg',     '/menu/oat-milk.jpg'),
  ('/menu/extra-shot.svg',   '/menu/extra-shot.jpg')
) as v(drawing, photo)
where m.image_url = v.drawing;
