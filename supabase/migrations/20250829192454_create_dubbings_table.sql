  create table "public"."dubbings" (
    "id" uuid not null default gen_random_uuid(),
    "mux_asset_id" text not null,
    "target_language" text not null,
    "elevenlabs_job_id" text,
    "status" text not null default 'pending'::text,
    "audio_url" text,
    "mux_track_id" text,
    "error_message" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "completed_at" timestamp with time zone
      );


alter table "public"."dubbings" enable row level security;

CREATE UNIQUE INDEX dubbings_mux_asset_id_target_language_key ON public.dubbings USING btree (mux_asset_id, target_language);

CREATE UNIQUE INDEX dubbings_pkey ON public.dubbings USING btree (id);

CREATE INDEX idx_dubbings_elevenlabs_job_id ON public.dubbings USING btree (elevenlabs_job_id);

CREATE INDEX idx_dubbings_mux_asset_id ON public.dubbings USING btree (mux_asset_id);

CREATE INDEX idx_dubbings_status ON public.dubbings USING btree (status);

alter table "public"."dubbings" add constraint "dubbings_pkey" PRIMARY KEY using index "dubbings_pkey";

alter table "public"."dubbings" add constraint "dubbings_mux_asset_id_target_language_key" UNIQUE using index "dubbings_mux_asset_id_target_language_key";

alter table "public"."dubbings" add constraint "dubbings_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'dubbed'::text, 'failed'::text, 'timeout'::text]))) not valid;

alter table "public"."dubbings" validate constraint "dubbings_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_dubbings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();

    -- Set completed_at when status changes to completed states
    IF NEW.status IN ('dubbed', 'failed', 'timeout') AND OLD.status NOT IN ('dubbed', 'failed', 'timeout') THEN
        NEW.completed_at = NOW();
    END IF;

    RETURN NEW;
END;
$function$
;

grant delete on table "public"."dubbings" to "anon";

grant insert on table "public"."dubbings" to "anon";

grant references on table "public"."dubbings" to "anon";

grant select on table "public"."dubbings" to "anon";

grant trigger on table "public"."dubbings" to "anon";

grant truncate on table "public"."dubbings" to "anon";

grant update on table "public"."dubbings" to "anon";

grant delete on table "public"."dubbings" to "authenticated";

grant insert on table "public"."dubbings" to "authenticated";

grant references on table "public"."dubbings" to "authenticated";

grant select on table "public"."dubbings" to "authenticated";

grant trigger on table "public"."dubbings" to "authenticated";

grant truncate on table "public"."dubbings" to "authenticated";

grant update on table "public"."dubbings" to "authenticated";

grant delete on table "public"."dubbings" to "service_role";

grant insert on table "public"."dubbings" to "service_role";

grant references on table "public"."dubbings" to "service_role";

grant select on table "public"."dubbings" to "service_role";

grant trigger on table "public"."dubbings" to "service_role";

grant truncate on table "public"."dubbings" to "service_role";

grant update on table "public"."dubbings" to "service_role";


  create policy "Authenticated users can read dubbings"
  on "public"."dubbings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Service role can manage dubbings"
  on "public"."dubbings"
  as permissive
  for all
  to service_role
using (true)
with check (true);


CREATE TRIGGER trigger_update_dubbings_updated_at BEFORE UPDATE ON public.dubbings FOR EACH ROW EXECUTE FUNCTION update_dubbings_updated_at();


