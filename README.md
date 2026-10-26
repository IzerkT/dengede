# Dengede

İki kişinin günlük kalori, protein ve su takibini özel bir alanda paylaşması için Next.js + Supabase MVP'si.

> Besin değerleri yaklaşık değerlerdir ve tıbbi öneri değildir. Paket üzerindeki değerler her zaman önceliklidir.

## Windows PowerShell ile yerelde çalıştırma

```powershell
Set-Location C:\Projects\caloriapp
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

Uygulama `http://localhost:3000` adresinde açılır.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Supabase kurulumu

1. Supabase'te ücretsiz bir proje oluşturun.
2. Project Settings > API bölümünden Project URL ve publishable/anon key değerlerini `.env.local` içine yazın. Service-role key'i istemciye göndermeyin.
3. SQL Editor'da migration dosyalarını zaman damgası sırasıyla çalıştırın. Yeni ilerleme özellikleri için son dosya `supabase\migrations\20261025233000_progress_history_achievements.sql`, güvenlik düzeltmesi için son dosya `supabase\migrations\20261026000000_harden_membership_and_water_rls.sql` dosyasıdır. Güvenlik migration'ı doğrudan `space_members` INSERT politikalarını kaldırır ve su kaydı güncellemesini hedef alanda üyelikle sınırlar; tablo veya veri silmez. Mevcut extension kurulumu otomatik olarak taşınmaz. SQL Editor ile daha önce uygulanan migration'lar Supabase CLI migration geçmişine otomatik yazılmaz; geçmiş ile dosyaların eşleştiğini doğrulamadan `supabase db push` çalıştırmayın. Supabase CLI ile geçmiş doğrulandıktan sonra:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <proje-ref>
npx.cmd supabase db push
```

SQL Editor kullandıysanız, migration'ın REST API'de görünmesi için aynı SQL Editor oturumunda bir kez çalıştırın:

```sql
notify pgrst, 'reload schema';
```

Güvenlik migration'ından sonra, SQL Editor'da aşağıdaki sorguyla doğrudan üyelik INSERT politikası kalmadığını, su güncelleme politikasının hem eski hem yeni satırda sahiplik ve üyelik kontrolü yaptığını ve RLS'nin açık olduğunu doğrulayın:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('space_members', 'water_entries', 'food_entries')
order by tablename, policyname;

select c.relname, c.relrowsecurity
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('space_members', 'water_entries', 'food_entries');
```

`space_members` için `cmd = 'INSERT'` satırı olmamalıdır. `water_update_owner` için `qual` ve `with_check` alanlarında `owner_id = auth.uid()` ile `public.is_space_member(space_id)` bulunmalıdır. Bu sorgular yalnızca doğrulama yapar; uzaktaki migration geçmişini değiştirmez.

Yiyecek kataloğu için `20261026010000_seed_food_catalog_codes.sql` migration'ını da çalıştırın. Bu migration `foods.catalog_code` alanını ekler, mevcut isimlerle eşleşen satırları korur ve eksik yerel katalog kayıtlarını UUID'leri veritabanı tarafından üretilerek ekler. Uygulama `egg`, `chicken` ve `rice` gibi kodları yalnızca UI için kullanır; `food_entry_items.food_id` alanına her zaman `foods.id` UUID'sini yazar. Migration uygulandıktan sonra şu doğrulama sorgusu her katalog kodu için bir UUID döndürmelidir:

```sql
select catalog_code, id, name
from public.foods
where catalog_code in (
  'egg', 'bread', 'white-cheese', 'yogurt', 'chicken', 'beef', 'fish',
  'rice', 'pasta', 'oats', 'potato', 'lentil', 'tomato', 'banana',
  'almond', 'olive-oil', 'menemen', 'kuru-fasulye'
)
order by catalog_code;
```

Uygulama ve migration dosyaları yerelde doğrulanmış olsa da canlı hatanın tamamen düzeldiğini söylemek için migration'ı hedef Supabase projesine uygulayın, PostgREST şemasını yenileyin ve giriş yapmış sıradan bir kullanıcıyla yumurta, tavuk ve pirinç ekleme akışını test edin. Service-role anahtarı kullanmayın.

Düzeltme migration'ının doğrulama sorgusu:

```sql
select
  to_regprocedure('public.create_invitation(uuid,interval)') as invitation_function,
  to_regprocedure('extensions.gen_random_bytes(integer)') as random_bytes_function,
  to_regprocedure('extensions.digest(text,text)') as digest_function,
  has_function_privilege('authenticated', 'public.create_invitation(uuid,interval)', 'EXECUTE') as authenticated_can_execute;
```

Sonuçta üç `to_regprocedure` alanı dolu ve `authenticated_can_execute` `true` olmalıdır. Gerçek authenticated RPC çalışmasını doğrulamak için uygulamada giriş yapmış alan sahibiyle **Partner daveti oluştur** düğmesine basın; başarıda ham token görünür. SQL Editor'da `auth.uid()` olmadığından RPC'yi oradan çalıştırmak normalde yetkilendirme hatası verir.

`/rest/v1/rpc/create_space` veya `/rest/v1/rpc/create_invitation` için 404 görürseniz ilgili migration uygulanmamış ya da PostgREST şeması yenilenmemiştir. `SQLSTATE 42883 function gen_random_bytes(integer) does not exist` görürseniz `20261025224100_fix_pgcrypto_schema.sql` migration'ını çalıştırın. `SQLSTATE 22023 unrecognized encoding: "base64url"` görürseniz `20261025224600_fix_invitation_encoding.sql` migration'ını çalıştırın. Dosyaları yeniden çalıştırıp yukarıdaki `NOTIFY` komutunu uygulayın. Bu SQL dosyaları uzak Supabase projesine otomatik uygulanmaz; gerçek SQL Editor/CLI adımı gereklidir.

4. Authentication > URL Configuration bölümünde Site URL'yi `http://localhost:3000` yapın ve Redirect URLs listesine `http://localhost:3000/auth/callback` ile production adresinizdeki `/auth/callback` URL'sini ekleyin.
5. Email confirmation açıkken kullanıcı doğrulama bağlantısından sonra giriş yapmalıdır. Kayıt formu doğrulama adresini otomatik olarak `/auth/callback` adresine yönlendirir; callback kodu session'a çevirir.
6. `.env.local` yalnızca şu iki istemci değişkenini içermelidir:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
```

Service-role veya başka bir secret key istemci koduna, `NEXT_PUBLIC_*` değişkenine ya da depoya eklenmemelidir.

RPC 404 teşhisinde tarayıcı Network isteğinin hostu `.env.local` içindeki `NEXT_PUBLIC_SUPABASE_URL` hostuyla aynı olmalıdır. Bu proje için beklenen host, çalışan yerel ayarda `tsxdkpxdzfyoqngikoqu.supabase.co`'dur. Uygulama geliştirme modunda RPC hata kodu, mesajı, details ve hint alanlarını konsola yazar; anahtarları veya token'ları yazdırmaz.

## İki hesap ve RLS doğrulaması

Kayıt sahipliği `food_entries.owner_id` ve `water_entries.owner_id` üzerinden yapılır; ortak alan yalnızca okuma kapsamını belirler. Mevcut verileri değiştirmeden önce Supabase SQL Editor'da şu tanı sorgularıyla alan dışı sahiplikleri inceleyin:

```sql
select fe.id, fe.space_id, fe.owner_id, fe.recorded_at
from public.food_entries fe
left join public.space_members sm
  on sm.space_id = fe.space_id and sm.user_id = fe.owner_id
where sm.user_id is null;

select we.id, we.space_id, we.owner_id, we.recorded_at
from public.water_entries we
left join public.space_members sm
  on sm.space_id = we.space_id and sm.user_id = we.owner_id
where sm.user_id is null;
```

Satır dönerse kayıtlar otomatik olarak yeniden atanmaz; iki hesabın gerçek sahipliği doğrulanmadan düzeltme yapılmamalıdır.

İlk hesapla kayıt olun, doğrulama bağlantısını açın ve giriş yapın. Dashboard'da **Yeni alan oluştur** ile alanı oluşturun, ardından **Partner daveti oluştur** düğmesinin ürettiği ham token'ı güvenli bir kanaldan ikinci kullanıcıya gönderin. İkinci kullanıcı kendi hesabıyla kayıt olup doğrulama bağlantısını açtıktan sonra token'ı giriş sonrası alana katıl ekranına girer. `create_space`, `create_invitation` ve `join_space` RPC'leri üyelik ve token işlemlerini transaction/security-definer akışında yürütür. Token SHA-256 hash olarak saklanır, süreli ve tek kullanımlıdır; alan iki üyeyi geçemez.

İki ayrı gizli tarayıcı oturumuyla doğrulayın:

1. Hesap A bir yiyecek ve su kaydı oluştursun; sayfayı yenilediğinde kayıtların kaldığını doğrulasın.
2. Hesap B davetle katılsın; A'nın kaydını okuyabilsin ama güncelleyemesin/silemesin.
3. `owner_id` değerini başkasına atayan insert/update istekleri reddedilsin.
4. Alan dışındaki hesap kayıtları göremesin.
5. Aynı token, süresi geçmiş token ve üçüncü üye denemesi reddedilsin.

Bu testlerde service-role key kullanmayın; service-role RLS'yi bypass eder.

## Vercel dağıtımı

GitHub deposunu Vercel'de **New Project > Import Git Repository** ile bağlayın. Build command `npm run build` olsun. `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` değerlerini Preview ve Production ortamlarına ekleyin. Supabase URL Configuration'a deployment callback URL'lerini ekleyin. Deploy sonrası iki test hesabıyla auth, davet, ortak dashboard ve RLS testlerini tekrarlayın.

## Günlük durumları ve üretim kontrol listesi

Günlük değerlendirme `src/lib/daily-status.ts` içinde tek bir kuralla yapılır. Her kullanıcı için yalnızca kendi kalori sınırı ve su hedefi kullanılır: her iki kayıt da varsa ve kalori sınırı karşılanıp su hedefi karşılanırsa **Başarılı**, yalnızca biri karşılanırsa **Kısmen başarılı**, ikisi de karşılanmazsa **Hedef kaçırıldı** olur. Hiç kayıt yoksa **Veri yok**, iki metrikten yalnızca biri kayıtlıysa **Veri eksik** gösterilir. Protein yalnızca beslenme özeti ve aylık raporda referanstır; başarı durumuna katılmaz. Veri yok/eksik günler başarı oranının paydasına girmez. **Başarı oranı = başarılı gün / değerlendirilebilir gün**, **veri kapsamı = değerlendirilebilir gün / takvim günü**. Kalori ve su değişiklikleri gün bazında `user_goal_history` tablosuna yazılır ve geçmiş günler o tarihte geçerli olan hedef revizyonuyla değerlendirilir. Takvim ve rapor sorguları yalnızca seçili ay aralığını çeker; günlük sınırlar Europe/Istanbul ile oluşturulur.

## Hydration uyarısı ve tarayıcı eklentileri

Geliştirici konsolunda `data-new-gr-c-s-check-loaded` veya `data-gr-ext-installed` özellikleri görülürse bunlar Grammarly benzeri bir yazım yardımcısının `<body>` üzerine React hydration öncesi eklediği tarayıcı özellikleridir. Doğrulamak için uygulamayı gizli pencerede, eklentiler devre dışı olacak şekilde açın; ardından aynı sayfada eklentileri tek tek etkinleştirerek uyarının ne zaman döndüğünü kontrol edin. Uyarı yalnızca eklenti açıkken oluşuyorsa uygulama kaynaklı değildir ve global `suppressHydrationWarning` eklenmemelidir.

Uygulamanın kendi tarafında ilk render sırasında saat dilimine göre değişebilen tarih metinleri sabit bir `"Bugün"` yer tutucusuyla başlatılır ve istemci oturumu hazırlandıktan sonra biçimlendirilir. Eklentiler kapalı gizli pencerede uyarı sürerse konsoldaki gerçek React farkını ve ilgili stack trace'i ayrıca inceleyin.

Yayınlamadan önce:

1. `npx.cmd supabase db push` ile migration'ları mevcut Supabase projesine uygulayın ve `notify pgrst, 'reload schema';` çalıştırın.
2. GitHub'a push edin; Vercel'de **Import Git Repository** ile projeyi içe aktarın.
3. Preview ve Production ortamlarına yalnızca `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ekleyin. Service-role anahtarını kullanmayın.
4. Supabase Authentication > URL Configuration bölümüne production `https://alaniniz.vercel.app/auth/callback` adresini ve Preview callback adreslerini ekleyin.
5. `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint` ve `npm.cmd run build` komutlarını çalıştırın.
6. İki ayrı hesapla kayıt, email doğrulama, alan oluşturma, davet oluşturma/katılma, farklı hedefler, geçmiş kayıtlar, partner okuma ve yalnızca sahip yazma/silme davranışlarını doğrulayın. Alan dışındaki hesapla food, water, profile, goal history ve achievement sorgularının reddedildiğini kontrol edin.
7. Gerçek Supabase ve Vercel deploy'u bu çalışma alanından yapılmadı; bu nedenle yayın tamamlandı iddiası ancak bu kontrol listesindeki uzak ortam doğrulamasından sonra yapılmalıdır.

Bu çalışma alanından gerçek Supabase veya Vercel deploy'u yapılmamıştır; bağlantının çalışması için yukarıdaki proje ayarları ve migration'lar sizin Supabase projenizde uygulanmalıdır.

## Veri ve hesap yönetimi

Supabase Database > Backups bölümünden düzenli yedek alın. Hesap silme ve alandan ayrılma işlemlerini production'da doğrulanmış server-side/RPC akışıyla ekleyin; service-role anahtarını tarayıcıya koymayın.

## Kapsam

Responsive Türkçe dashboard, Supabase email auth/session callback'leri, RLS-scoped persisted food/water/goal/profile reads and writes, invitation RPC'leri, yaklaşık Türkçe/common food seed verisi, deterministik gram/serving dönüşümü, kalori/protein snapshot mantığı ve hızlı su ekleme hazırdır. Egzersiz, yürüyüş ve AI parser ilk sürüme dahil değildir.
