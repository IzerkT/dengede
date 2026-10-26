import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const initialMigration = readFileSync("supabase/migrations/20261025210000_initial_schema.sql", "utf8");
const integrationMigration = readFileSync("supabase/migrations/20261025220500_integration_functions.sql", "utf8");
const pgcryptoMigration = readFileSync("supabase/migrations/20261025224100_fix_pgcrypto_schema.sql", "utf8");
const encodingMigration = readFileSync("supabase/migrations/20261025224600_fix_invitation_encoding.sql", "utf8");
const partnerGoalsMigration = readFileSync("supabase/migrations/20261025231700_partner_goals_rls.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/20261026000000_harden_membership_and_water_rls.sql", "utf8");

describe("database authorization contract", () => {
  it("keeps tracking tables protected by RLS and owner-only mutations", () => {
    expect(initialMigration).toContain("alter table public.food_entries enable row level security");
    expect(initialMigration).toContain("create policy entries_update_owner");
    expect(initialMigration).toContain("create policy entries_create_owner");
    expect(initialMigration).toContain("with check (owner_id = auth.uid()");
    expect(initialMigration).toContain("public.is_space_member(space_id)");
    expect(initialMigration).toContain("create policy water_delete_owner");
  });

  it("requires secure invitation RPCs and a two-member limit", () => {
    expect(integrationMigration).toContain("create or replace function public.create_space");
    expect(integrationMigration).toContain("create or replace function public.create_invitation");
    expect(initialMigration).toContain("if member_count >= 2");
    expect(initialMigration).toContain("invite.used_at is not null");
    expect(initialMigration).toContain("invite.expires_at <= now()");
  });

  it("qualifies pgcrypto calls and verifies the corrective migration", () => {
    expect(pgcryptoMigration).toContain("create extension pgcrypto with schema extensions");
    expect(pgcryptoMigration).toContain("extensions.gen_random_bytes(24)");
    expect(pgcryptoMigration).toContain("extensions.digest(raw_token, 'sha256')");
    expect(pgcryptoMigration).toContain("extensions.digest(invite_token, 'sha256')");
    expect(pgcryptoMigration).not.toContain("encode(gen_random_bytes(24)");
    expect(pgcryptoMigration).toContain("to_regprocedure('extensions.gen_random_bytes(integer)')");
  });

  it("uses PostgreSQL-supported base64 and converts it to URL-safe token text", () => {
    expect(encodingMigration).toContain("encode(extensions.gen_random_bytes(24), 'base64')");
    expect(encodingMigration).toContain("rtrim(");
    expect(encodingMigration).toContain("'+/'");
    expect(encodingMigration).toContain("'-_'");
    expect(encodingMigration).not.toContain("'base64url'");
  });

  it("allows shared-space goal reads without allowing cross-space access", () => {
    expect(partnerGoalsMigration).toContain("create policy goals_read_same_space");
    expect(partnerGoalsMigration).toContain("mine.user_id = auth.uid()");
    expect(partnerGoalsMigration).toContain("theirs.user_id = public.user_goals.user_id");
    expect(partnerGoalsMigration).not.toContain("for insert");
    expect(partnerGoalsMigration).not.toContain("for update");
  });

  it("removes all direct membership inserts and constrains water moves", () => {
    expect(hardeningMigration).toContain("cmd = 'INSERT'");
    expect(hardeningMigration).toContain("drop policy if exists");
    expect(hardeningMigration).toContain("water_update_owner");
    expect(hardeningMigration).toContain("using (");
    expect(hardeningMigration).toContain("with check (");
    expect(hardeningMigration).toContain("owner_id = auth.uid()");
    expect(hardeningMigration).toContain("public.is_space_member(space_id)");
    expect(hardeningMigration).toContain("space_members must not expose direct INSERT policies");
  });

  it("keeps invitation RPC checks and safe food-entry integrity policies", () => {
    expect(pgcryptoMigration).toContain("security definer");
    expect(pgcryptoMigration).toContain("set search_path = public");
    expect(pgcryptoMigration).toContain("invite.used_at is not null");
    expect(pgcryptoMigration).toContain("invite.expires_at <= now()");
    expect(pgcryptoMigration).toContain("if member_count >= 2");
    expect(integrationMigration).toContain("if exists (select 1 from public.space_members where user_id = auth.uid())");
    expect(initialMigration).toContain("entries_create_owner on public.food_entries for insert with check (owner_id = auth.uid() and public.is_space_member(space_id))");
    expect(initialMigration).toContain("entries_update_owner on public.food_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and public.is_space_member(space_id))");
  });
});
