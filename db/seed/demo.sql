-- Sample listings for development and demos only. Do NOT load in production:
-- the businesses, phone numbers and reviews below are invented.

INSERT INTO businesses (name, slug, category_id, area_id, market_section_id, shop_number,
  description, landmark_directions, location, whatsapp, phone, price_min_ngn, price_max_ngn,
  price_items, comes_to_you, service_area_ids, hours_note, is_open_now, open_status_note, open_status_at,
  verification_level, last_confirmed_at, status, source)
SELECT v.name, v.slug,
  (SELECT id FROM categories WHERE slug = v.cat),
  (SELECT id FROM areas WHERE slug = v.area),
  (SELECT id FROM market_sections WHERE name = v.section),
  v.shop, v.descr, v.directions,
  CASE WHEN v.lat IS NULL THEN NULL ELSE ST_MakePoint(v.lng, v.lat)::geography END,
  v.wa, v.wa, v.pmin, v.pmax, v.items::jsonb, v.ctu,
  coalesce((SELECT array_agg(id) FROM areas WHERE slug = ANY (v.serves)), '{}'),
  v.hours, v.open, v.open_note, now() - v.open_age,
  v.verif, now() - v.confirm_age, 'live', 'agent'
FROM (VALUES
  ('Chidi Phone Clinic', 'chidi-phone-clinic', 'phone-repair', 'ikeja', 'Line 2, ground floor', 'D47',
   'Phone screen, battery and charging port repair. iPhone and Android.',
   'Enter Otigba from the Ikeja Along side. Walk past the big Glo office, second plaza on your left, ground floor, Line 2. Ask for Chidi, yellow signboard.',
   6.5958, 3.3428, '+2348000000001', 5000, 45000,
   '[{"label":"Screen replacement","min":15000,"max":45000},{"label":"Battery","min":8000,"max":20000},{"label":"Charging port","min":5000,"max":12000}]',
   FALSE, ARRAY[]::text[], 'Mon to Sat, roughly 9am to 7pm', TRUE, NULL::text, interval '2 hours',
   'visited', interval '1 day'),
  ('Mide Gadgets Fix', 'mide-gadgets-fix', 'phone-repair', 'ikeja', 'Plaza B', 'Shop 12',
   'Phone and tablet repairs, screen protectors fitted while you wait.',
   'Pepple Street, enter Plaza B beside the pharmacy, first shop on the right.',
   6.5970, 3.3440, '+2348000000002', 12000, 40000, '[]',
   FALSE, ARRAY[]::text[], 'Mon to Sat, 9am to 6pm', TRUE, NULL, interval '1 day',
   'visited', interval '3 days'),
  ('Aisha Screen Masters', 'aisha-screen-masters', 'phone-repair', 'ikeja', 'Line 5, first floor', 'F3',
   'Original and high-copy screens for most phones.',
   'Otigba Street, climb the stairs by the shoe seller, first floor, Line 5.',
   6.5955, 3.3420, '+2348000000003', 18000, 50000, '[]',
   FALSE, ARRAY[]::text[], 'Mon to Sat', FALSE, 'Light issue, back tomorrow', interval '3 hours',
   'visited', interval '5 days'),
  ('Emeka Accessories', 'emeka-accessories', 'phone-repair', 'ikeja', 'Line 2, ground floor', 'D48',
   'Chargers, cables, cases and power banks.',
   'Next door to Chidi Phone Clinic, Otigba Street, Line 2.',
   6.5958, 3.3429, '+2348000000004', 1500, 25000, '[]',
   FALSE, ARRAY[]::text[], NULL, TRUE, NULL, interval '1 day',
   'phone', interval '10 days'),
  ('Kola Laptop Hub', 'kola-laptop-hub', 'laptop-repair', 'ikeja', 'Line 2, ground floor', 'D49',
   'Laptop repairs and fairly used laptops.',
   'Otigba Street, Line 2, two shops after Chidi Phone Clinic.',
   6.5959, 3.3430, '+2348000000005', 10000, 80000, '[]',
   FALSE, ARRAY[]::text[], NULL, NULL, NULL, interval '70 days',
   'none', interval '70 days'),
  ('Bayo Cool Air', 'bayo-cool-air', 'ac-repair', 'yaba', NULL, NULL,
   'AC installation, servicing and gas refill. Comes to your house.',
   'Mobile service, call or chat to book.',
   6.5095, 3.3711, '+2348000000006', 8000, 35000, '[]',
   TRUE, ARRAY['yaba','surulere','ikeja','maryland','gbagada'], 'Every day, 8am to 8pm', TRUE, NULL, interval '5 hours',
   'visited', interval '2 days'),
  ('Lekan Gen Repairs', 'lekan-gen-repairs', 'generator-repair', 'ikeja', NULL, NULL,
   'Small and big generator repairs, servicing and rewinding.',
   'Opposite Mobil filling station on Obafemi Awolowo Way, enter the street after the second bus stop, blue gate.',
   6.6050, 3.3500, '+2348000000007', 5000, 60000, '[]',
   TRUE, ARRAY['ikeja','ogba','maryland','agege'], 'Mon to Sat', TRUE, NULL, interval '1 day',
   'phone', interval '6 days'),
  ('Mama Tolu Kitchen', 'mama-tolu-kitchen', 'bukas', 'yaba', NULL, NULL,
   'Amala, ewedu, gbegiri and rice. Lunch rush 12 to 3.',
   'Behind Yaba market, the yellow canopy beside the tailor, opposite the mosque.',
   6.5120, 3.3780, '+2348000000008', 1500, 4500, '[]',
   FALSE, ARRAY[]::text[], 'Mon to Sat, 8am to 5pm', TRUE, NULL, interval '4 hours',
   'visited', interval '1 day'),
  ('Sola Cuts', 'sola-cuts', 'barbers', 'surulere', NULL, NULL,
   'Barbing salon. Low cut, fade, beard trim.',
   'Adeniran Ogunsanya, after the shopping mall, small street on the left, second shop.',
   6.4950, 3.3560, '+2348000000009', 2000, 6000, '[]',
   FALSE, ARRAY[]::text[], 'Every day, 9am to 9pm', TRUE, NULL, interval '1 day',
   'phone', interval '4 days'),
  ('Ngozi Hair Studio', 'ngozi-hair-studio', 'hair-salons', 'lekki-phase-1', NULL, NULL,
   'Braids, wig installation and treatment.',
   'Admiralty Way, opposite the bank, inside the plaza with the green roof, first floor.',
   6.4480, 3.4700, '+2348000000010', 8000, 45000, '[]',
   FALSE, ARRAY[]::text[], 'Tue to Sun', TRUE, NULL, interval '1 day',
   'visited', interval '8 days'),
  ('Femi Plumbing Works', 'femi-plumbing-works', 'plumbing', 'festac', NULL, NULL,
   'Leaks, blocked drains, pumping machine and borehole plumbing.',
   'Mobile service around Festac and Amuwo Odofin.',
   6.4667, 3.2833, '+2348000000011', 5000, 50000, '[]',
   TRUE, ARRAY['festac','apapa','ojo'], NULL, TRUE, NULL, interval '1 day',
   'phone', interval '12 days'),
  ('Ada Small Chops', 'ada-small-chops', 'caterers', 'ikorodu', NULL, NULL,
   'Small chops and jollof for parties, from 50 guests.',
   'Ikorodu Garage, the street beside the church, house with the black gate.',
   6.6194, 3.5105, '+2348000000012', 50000, 400000, '[]',
   TRUE, ARRAY['ikorodu','magodo','ogba'], 'Order 3 days ahead', NULL, NULL, interval '1 day',
   'phone', interval '20 days')
) AS v(name, slug, cat, area, section, shop, descr, directions, lat, lng, wa, pmin, pmax, items,
       ctu, serves, hours, open, open_note, open_age, verif, confirm_age)
ON CONFLICT (slug) DO NOTHING;

-- A few contact events and reviews tied to them.
WITH e AS (
  INSERT INTO contact_events (business_id, visitor_id, channel, created_at)
  SELECT b.id, 'demo-' || v.n, 'whatsapp', now() - v.age
  FROM (VALUES
    ('chidi-phone-clinic', 1, interval '10 days'),
    ('chidi-phone-clinic', 2, interval '6 days'),
    ('mama-tolu-kitchen',  3, interval '3 days'),
    ('bayo-cool-air',      4, interval '8 days')
  ) AS v(slug, n, age)
  JOIN businesses b ON b.slug = v.slug
  WHERE NOT EXISTS (SELECT 1 FROM contact_events x WHERE x.visitor_id = 'demo-' || v.n)
  RETURNING id, business_id, visitor_id
)
INSERT INTO reviews (business_id, reviewer_name, contact_event_id, rating, body)
SELECT e.business_id, v.who, e.id, v.rating, v.body
FROM e JOIN (VALUES
  ('demo-1', 'Tunde O.', 5, 'Fixed my iPhone screen in one hour. Price was exactly what he quoted on WhatsApp.'),
  ('demo-2', 'Ngozi A.', 5, 'Directions were spot on. Na the first time I no get lost for Computer Village.'),
  ('demo-3', 'Kemi B.',  4, 'Amala sweet well. Go before 1pm or the queue go long.'),
  ('demo-4', 'Dayo F.',  5, 'Came the same day and the AC is cold again.')
) AS v(visitor, who, rating, body) ON v.visitor = e.visitor_id;
