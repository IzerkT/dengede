-- Keep local catalog codes separate from foods.id, which is a UUID foreign key.
alter table public.foods
  add column if not exists catalog_code text;

update public.foods
set catalog_code = 'egg'
where catalog_code is null
  and name = 'Yumurta'
  and not exists (select 1 from public.foods where catalog_code = 'egg');
update public.foods
set catalog_code = 'bread'
where catalog_code is null
  and name = 'Ekmek'
  and not exists (select 1 from public.foods where catalog_code = 'bread');
update public.foods
set catalog_code = 'white-cheese'
where catalog_code is null
  and name = 'Beyaz peynir'
  and not exists (select 1 from public.foods where catalog_code = 'white-cheese');
update public.foods
set catalog_code = 'yogurt'
where catalog_code is null
  and name = 'Yoğurt'
  and not exists (select 1 from public.foods where catalog_code = 'yogurt');
update public.foods
set catalog_code = 'chicken'
where catalog_code is null
  and name = 'Tavuk göğsü (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'chicken');
update public.foods
set catalog_code = 'beef'
where catalog_code is null
  and name = 'Dana eti (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'beef');
update public.foods
set catalog_code = 'fish'
where catalog_code is null
  and name = 'Levrek (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'fish');
update public.foods
set catalog_code = 'rice'
where catalog_code is null
  and name = 'Pirinç (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'rice');
update public.foods
set catalog_code = 'pasta'
where catalog_code is null
  and name = 'Makarna (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'pasta');
update public.foods
set catalog_code = 'oats'
where catalog_code is null
  and name = 'Yulaf ezmesi'
  and not exists (select 1 from public.foods where catalog_code = 'oats');
update public.foods
set catalog_code = 'potato'
where catalog_code is null
  and name = 'Patates (haşlanmış)'
  and not exists (select 1 from public.foods where catalog_code = 'potato');
update public.foods
set catalog_code = 'lentil'
where catalog_code is null
  and name = 'Mercimek (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'lentil');
update public.foods
set catalog_code = 'tomato'
where catalog_code is null
  and name = 'Domates'
  and not exists (select 1 from public.foods where catalog_code = 'tomato');
update public.foods
set catalog_code = 'banana'
where catalog_code is null
  and name = 'Muz'
  and not exists (select 1 from public.foods where catalog_code = 'banana');
update public.foods
set catalog_code = 'almond'
where catalog_code is null
  and name = 'Badem'
  and not exists (select 1 from public.foods where catalog_code = 'almond');
update public.foods
set catalog_code = 'olive-oil'
where catalog_code is null
  and name = 'Zeytinyağı'
  and not exists (select 1 from public.foods where catalog_code = 'olive-oil');
update public.foods
set catalog_code = 'menemen'
where catalog_code is null
  and name = 'Menemen'
  and not exists (select 1 from public.foods where catalog_code = 'menemen');
update public.foods
set catalog_code = 'kuru-fasulye'
where catalog_code is null
  and name = 'Kuru fasulye (pişmiş)'
  and not exists (select 1 from public.foods where catalog_code = 'kuru-fasulye');

create unique index if not exists foods_catalog_code_uidx
  on public.foods(catalog_code);

insert into public.foods (
  catalog_code, name, alternative_names, calories_per_100,
  protein_per_100, default_unit, grams_per_unit, source, is_approximate
)
values
  ('egg', 'Yumurta', array['Haşlanmış yumurta'], 155, 13, 'piece', 50, 'USDA FoodData Central, yaklaşık', true),
  ('bread', 'Ekmek', array['Tam buğday ekmeği'], 265, 9, 'slice', 30, 'USDA FoodData Central, yaklaşık', true),
  ('white-cheese', 'Beyaz peynir', array['Peynir'], 264, 14, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('yogurt', 'Yoğurt', array['Süzme yoğurt'], 61, 3.5, 'cup', 200, 'USDA FoodData Central, yaklaşık', true),
  ('chicken', 'Tavuk göğsü (pişmiş)', array['Tavuk'], 165, 31, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('beef', 'Dana eti (pişmiş)', array['Kırmızı et'], 250, 26, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('fish', 'Levrek (pişmiş)', array['Balık'], 124, 24, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('rice', 'Pirinç (pişmiş)', array['Pilav'], 130, 2.7, 'cup', 160, 'USDA FoodData Central, yaklaşık', true),
  ('pasta', 'Makarna (pişmiş)', array['Sade makarna'], 157, 5.8, 'cup', 140, 'USDA FoodData Central, yaklaşık', true),
  ('oats', 'Yulaf ezmesi', array['Yulaf'], 389, 16.9, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('potato', 'Patates (haşlanmış)', array['Patates'], 87, 1.9, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('lentil', 'Mercimek (pişmiş)', array['Mercimek yemeği'], 116, 9, 'cup', 200, 'USDA FoodData Central, yaklaşık', true),
  ('tomato', 'Domates', array[]::text[], 18, 0.9, 'piece', 120, 'USDA FoodData Central, yaklaşık', true),
  ('banana', 'Muz', array[]::text[], 89, 1.1, 'piece', 118, 'USDA FoodData Central, yaklaşık', true),
  ('almond', 'Badem', array['Çiğ badem'], 579, 21.2, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('olive-oil', 'Zeytinyağı', array[]::text[], 884, 0, 'g', 1, 'USDA FoodData Central, yaklaşık', true),
  ('menemen', 'Menemen', array['Yumurtalı menemen'], 120, 6, 'portion', 200, 'İçerik tarifine göre yaklaşık hesap', true),
  ('kuru-fasulye', 'Kuru fasulye (pişmiş)', array['Fasulye yemeği'], 140, 9, 'cup', 200, 'İçerik tarifine göre yaklaşık hesap', true)
on conflict (catalog_code) do nothing;
