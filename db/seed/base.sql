-- Base data needed in every environment: Lagos, its areas, categories, markets.
-- Area centre points are approximate; refine them as field agents map areas.

INSERT INTO cities (name, state, slug, is_live) VALUES ('Lagos', 'Lagos', 'lagos', TRUE)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO areas (city_id, name, slug, aliases, centre)
SELECT c.id, v.name, v.slug, v.aliases, ST_MakePoint(v.lng, v.lat)::geography
FROM cities c, (VALUES
  ('Ikeja',           'ikeja',           ARRAY['Ikeja GRA','Allen','Alausa'],         6.6018, 3.3515),
  ('Yaba',            'yaba',            ARRAY['Sabo','Akoka','Onike'],               6.5095, 3.3711),
  ('Surulere',        'surulere',        ARRAY['Ojuelegba','Adeniran Ogunsanya'],     6.4969, 3.3539),
  ('Lekki Phase 1',   'lekki-phase-1',   ARRAY['Lekki 1','Lekki Ph 1','Lekki'],       6.4474, 3.4723),
  ('Ajah',            'ajah',            ARRAY['Abraham Adesanya','Sangotedo'],       6.4698, 3.5852),
  ('Victoria Island', 'victoria-island', ARRAY['VI','V.I.'],                          6.4281, 3.4219),
  ('Ikoyi',           'ikoyi',           ARRAY['Falomo','Obalende'],                  6.4500, 3.4350),
  ('Lagos Island',    'lagos-island',    ARRAY['Island','Isale Eko','CMS','Idumota'], 6.4541, 3.3947),
  ('Ikorodu',         'ikorodu',         ARRAY['Ikorodu Garage','Agric'],             6.6194, 3.5105),
  ('Festac',          'festac',          ARRAY['Festac Town','Amuwo Odofin'],         6.4667, 3.2833),
  ('Maryland',        'maryland',        ARRAY['Mende','Anthony'],                    6.5710, 3.3670),
  ('Gbagada',         'gbagada',         ARRAY['Gbagada Phase 1','Gbagada Phase 2'],  6.5550, 3.3890),
  ('Ogba',            'ogba',            ARRAY['Ogba Aguda','Ifako'],                 6.6280, 3.3410),
  ('Oshodi',          'oshodi',          ARRAY['Isolo','Mafoluku'],                   6.5550, 3.3430),
  ('Mushin',          'mushin',          ARRAY['Idi Araba','Ladipo'],                 6.5300, 3.3500),
  ('Apapa',           'apapa',           ARRAY['Ajegunle','Kirikiri'],                6.4480, 3.3590),
  ('Ojo',             'ojo',             ARRAY['Alaba','Okokomaiko','Iyana Iba'],     6.4600, 3.1800),
  ('Magodo',          'magodo',          ARRAY['Isheri','Shangisha'],                 6.6150, 3.3820),
  ('Agege',           'agege',           ARRAY['Pen Cinema','Abule Egba'],            6.6250, 3.3200),
  ('Egbeda',          'egbeda',          ARRAY['Idimu','Ikotun','Igando'],            6.5920, 3.2850)
) AS v(name, slug, aliases, lat, lng)
WHERE c.slug = 'lagos'
ON CONFLICT (city_id, slug) DO NOTHING;

-- Categories: parent groups, then children. Synonyms include Pidgin and the
-- words people actually type.
INSERT INTO categories (name, slug, synonyms, sort_order) VALUES
  ('Repairs and tech', 'repairs-tech',  ARRAY['repair','fix'], 1),
  ('Home artisans',    'home-artisans', ARRAY['artisan','handyman','technician'], 2),
  ('Food',             'food',          ARRAY['chop','eat','food'], 3),
  ('Beauty',           'beauty',        ARRAY['beauty'], 4),
  ('Auto',             'auto',          ARRAY['car','motor'], 5),
  ('Fashion',          'fashion',       ARRAY['clothes','fashion'], 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (parent_id, name, slug, synonyms, sort_order)
SELECT p.id, v.name, v.slug, v.synonyms, v.ord
FROM (VALUES
  ('repairs-tech',  'Phone repair',          'phone-repair',      ARRAY['phone','screen','iphone','android','battery','charging port','phone doctor','phone engineer'], 1),
  ('repairs-tech',  'Laptop repair',         'laptop-repair',     ARRAY['laptop','computer','macbook','pc','system'], 2),
  ('repairs-tech',  'Electronics repair',    'electronics-repair',ARRAY['tv','fridge','freezer','appliance','microwave'], 3),
  ('home-artisans', 'AC repair',             'ac-repair',         ARRAY['ac','air conditioner','aircon','cooling','ac man'], 1),
  ('home-artisans', 'Plumbing',              'plumbing',          ARRAY['plumber','pipe','leak','water','borehole'], 2),
  ('home-artisans', 'Electrical',            'electrical',        ARRAY['electrician','wiring','light','nepa','inverter','solar'], 3),
  ('home-artisans', 'Generator repair',      'generator-repair',  ARRAY['gen','generator','fix gen','gen man','gen repair','generator man'], 4),
  ('home-artisans', 'Carpentry',             'carpentry',         ARRAY['carpenter','furniture','door','wardrobe'], 5),
  ('home-artisans', 'Painting',              'painting',          ARRAY['painter','paint','pop','screeding'], 6),
  ('food',          'Bukas and local food',  'bukas',             ARRAY['buka','mama put','amala','eba','swallow','local food','rice'], 1),
  ('food',          'Restaurants',           'restaurants',       ARRAY['restaurant','eatery','lounge'], 2),
  ('food',          'Caterers',              'caterers',          ARRAY['catering','caterer','small chops','party food','jollof'], 3),
  ('beauty',        'Hair salons',           'hair-salons',       ARRAY['salon','hair','braids','weave','wig','hairdresser'], 1),
  ('beauty',        'Barbers',               'barbers',           ARRAY['barber','barbing','barbing salon','haircut','low cut'], 2),
  ('beauty',        'Makeup artists',        'makeup',            ARRAY['makeup','make up','mua','gele'], 3),
  ('auto',          'Mechanics',             'mechanics',         ARRAY['mechanic','car repair','panel beater','rewire'], 1),
  ('auto',          'Vulcanisers',           'vulcanisers',       ARRAY['vulcanizer','vulcaniser','tyre','tire','puncture'], 2),
  ('fashion',       'Tailors',               'tailors',           ARRAY['tailor','fashion designer','sew','aso ebi','alteration'], 1)
) AS v(parent, name, slug, synonyms, ord)
JOIN categories p ON p.slug = v.parent
ON CONFLICT (slug) DO NOTHING;

-- Markets and their sections (approximate locations).
INSERT INTO markets (area_id, name, slug, description, location)
SELECT a.id, v.name, v.slug, v.descr, ST_MakePoint(v.lng, v.lat)::geography
FROM (VALUES
  ('ikeja',        'Computer Village',       'computer-village', 'Phones, laptops, accessories and repairs', 6.5960, 3.3430),
  ('lagos-island', 'Balogun Market',         'balogun',          'Fabrics, clothes, shoes and household goods', 6.4540, 3.3890),
  ('ojo',          'Alaba International',    'alaba',            'Electronics and appliances', 6.4630, 3.1890),
  ('mushin',       'Ladipo Market',          'ladipo',           'Car parts and auto repairs', 6.5440, 3.3490)
) AS v(area, name, slug, descr, lat, lng)
JOIN areas a ON a.slug = v.area
ON CONFLICT (slug) DO NOTHING;

INSERT INTO market_sections (market_id, kind, name, sort_order)
SELECT m.id, 'street', v.name, v.ord
FROM markets m, (VALUES ('Otigba Street', 1), ('Pepple Street', 2), ('Ola Ayeni Street', 3)) AS v(name, ord)
WHERE m.slug = 'computer-village'
  AND NOT EXISTS (SELECT 1 FROM market_sections s WHERE s.market_id = m.id AND s.name = v.name);

INSERT INTO market_sections (market_id, parent_id, kind, name, sort_order)
SELECT p.market_id, p.id, v.kind, v.name, v.ord
FROM (VALUES
  ('Otigba Street', 'line',  'Line 2, ground floor', 1),
  ('Otigba Street', 'line',  'Line 5, first floor',  2),
  ('Pepple Street', 'plaza', 'Plaza B',              1)
) AS v(parent, kind, name, ord)
JOIN market_sections p ON p.name = v.parent AND p.parent_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM market_sections s WHERE s.parent_id = p.id AND s.name = v.name);
