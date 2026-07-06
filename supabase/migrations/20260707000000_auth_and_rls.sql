-- Auth: tie listings/rentals to auth.uid(). Backfill-safe — legacy rows keep
-- null user ids (platform-owned) and stay readable exactly as before.

alter table gimi.items add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table gimi.items add column if not exists renter_id uuid references auth.users(id) on delete set null;
alter table gimi.rentals add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists items_owner_id_idx on gimi.items(owner_id);
create index if not exists items_renter_id_idx on gimi.items(renter_id);
create index if not exists rentals_user_id_idx on gimi.rentals(user_id);
create index if not exists rentals_item_id_idx on gimi.rentals(item_id);
create index if not exists receipts_rental_id_idx on gimi.receipts(rental_id);

-- Items: anonymous browse stays (items_world_read); owners manage their own listings.
drop policy if exists items_owner_insert on gimi.items;
create policy items_owner_insert on gimi.items
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists items_owner_update on gimi.items;
create policy items_owner_update on gimi.items
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists items_owner_delete on gimi.items;
create policy items_owner_delete on gimi.items
  for delete to authenticated
  using (owner_id = auth.uid());

-- Rentals: the renter sees their own rentals; the item owner sees rentals of
-- their items. Writes stay service-role only (payment flow).
drop policy if exists rentals_party_read on gimi.rentals;
create policy rentals_party_read on gimi.rentals
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from gimi.items i where i.id = item_id and i.owner_id = auth.uid())
  );

-- Receipts: readable by the parties to the rental. Writes service-role only.
drop policy if exists receipts_party_read on gimi.receipts;
create policy receipts_party_read on gimi.receipts
  for select to authenticated
  using (
    exists (
      select 1
      from gimi.rentals r
      left join gimi.items i on i.id = r.item_id
      where r.id = rental_id
        and (r.user_id = auth.uid() or i.owner_id = auth.uid())
    )
  );

grant insert, update, delete on gimi.items to authenticated;
grant select on gimi.rentals to authenticated;
grant select on gimi.receipts to authenticated;
