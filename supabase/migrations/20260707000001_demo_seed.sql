-- Realistic demo inventory (idempotent). Legacy platform-seeded rows keep
-- owner_id null; the `owner` text column carries a display handle.

insert into gimi.items
  (id, name, brand, model, condition, description, image_url, daily_rate, retail_price, overage_multiplier, status, owner, category, trust_score, created_at)
values
  ('6', 'DJI Mini 4 Pro Drone', 'DJI', 'Mini 4 Pro Fly More Combo', 9,
   'Sub-250g drone with 4K/60 HDR, three batteries and controller. Registered and ready to fly.',
   'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&h=300&fit=crop',
   30, 1099, 2.0, 'available', 'skyworks.demo', 'Electronics', 93, now() - interval '4 days'),
  ('7', 'Burton Custom Snowboard 158', 'Burton', 'Custom 158 + Malavita bindings', 8,
   'All-mountain classic, freshly waxed, edges tuned. Bindings fit US 9-11 boots.',
   'https://images.unsplash.com/photo-1522056615691-da7b8106c665?w=400&h=300&fit=crop',
   25, 850, 1.5, 'available', 'powderhound.demo', 'Sports', 89, now() - interval '6 days'),
  ('8', 'Makita 7-1/4" Circular Saw', 'Makita', '5007MG Magnesium', 8,
   'Lightweight magnesium saw with fresh carbide blade. Includes rip fence and case.',
   'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop',
   9, 189, 1.5, 'available', 'buildright.demo', 'Tools', 91, now() - interval '2 days'),
  ('9', 'Canon EF 70-200mm f/2.8L IS III', 'Canon', 'EF 70-200mm f/2.8L IS III USM', 9,
   'Pro telephoto zoom, tack sharp. Comes with tripod collar, hood, and both caps.',
   'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=400&h=300&fit=crop',
   40, 2099, 2.0, 'available', 'glassrental.demo', 'Electronics', 96, now() - interval '1 day'),
  ('10', 'Traeger Pro 575 Pellet Grill', 'Traeger', 'Pro 575 WiFi', 7,
   'Wood-pellet smoker with WiFIRE app control. Cleaned after every rental; hopper included.',
   'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop',
   18, 899, 1.5, 'available', 'backyardbbq.demo', 'Kitchen', 87, now() - interval '8 days'),
  ('11', 'Peak Design Travel Tripod', 'Peak Design', 'Carbon Fiber', 9,
   'Packs down to a water-bottle footprint. Includes mobile mount and soft case.',
   'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?w=400&h=300&fit=crop',
   12, 599, 1.5, 'available', 'glassrental.demo', 'Electronics', 96, now() - interval '3 days')
on conflict (id) do nothing;

-- Data fix: item 4 was seeded as 'rented' with no rentals row, so it could
-- never be returned through the real flow. Make it rentable.
update gimi.items
set status = 'available', renter = null, renter_id = null, rental_start = null, rental_days = null
where id = '4'
  and status = 'rented'
  and not exists (select 1 from gimi.rentals r where r.item_id = '4' and r.status = 'active');
