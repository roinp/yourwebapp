# yourwebapp — სტომატოლოგიური კლინიკის მართვა

Next.js 16 + Tailwind CSS 4 + Supabase (PostgreSQL + Auth).

**ფუნქციონალი:** შესვლა · მთავარი (დღევანდელი/მომავალი ვიზიტები, პაციენტების რაოდენობა) · პაციენტები (დამატება, რედაქტირება, წაშლა, ძებნა სახელით/ტელეფონით) · პაციენტის პროფილი + მკურნალობის ისტორია · ვიზიტების კალენდარი · ექიმები.

## Supabase-თან დაკავშირება

1. **პროექტის შექმნა** — შედით [supabase.com](https://supabase.com)-ზე → *New project*.
2. **ცხრილების შექმნა** — *SQL Editor* → *New query* → ჩასვით [`supabase/schema.sql`](supabase/schema.sql)-ის შიგთავსი → *Run*.
   იქმნება ცხრილები: `users`, `patients`, `doctors`, `appointments`, `treatments` (+ RLS წესები).
3. **გასაღებები** — *Project Settings → API* (ან *Connect*):
   დააკოპირეთ **Project URL** და **anon public key** ფაილში `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```
4. **თანამშრომლის ანგარიში** — *Authentication → Users → Add user → Create new user*
   (ელ-ფოსტა + პაროლი, მონიშნეთ *Auto Confirm User*). ის ავტომატურად დაემატება `public.users`-ში.
   ადმინად გასახდომად: `update public.users set role = 'admin' where email = 'you@example.com';`
5. **გაშვება:**
   ```bash
   npm install
   npm run dev
   ```
   გახსენით http://localhost:3000 და შედით შექმნილი მომხმარებლით.

> `.env.local`-ის შეცვლის შემდეგ dev სერვერი უნდა გადაიტვირთოს.

## სამუშაო პროცესი

პაციენტის დამატება → ვიზიტის დაჯავშნა → პაციენტის პროფილის გახსნა → მკურნალობის დამატება → ინფორმაციის რედაქტირება.

## სტრუქტურა

```
supabase/schema.sql            ბაზის სქემა
src/lib/                       Supabase კლიენტი, ტიპები, ფორმატირება
src/components/                მოდალები და ფორმები
src/app/login/                 შესვლის გვერდი
src/app/(clinic)/              დაცული გვერდები (sidebar + auth შემოწმება)
  page.tsx                     მთავარი
  patients/, patients/[id]/    პაციენტები და პროფილი
  calendar/                    კალენდარი
  doctors/                     ექიმები
```
