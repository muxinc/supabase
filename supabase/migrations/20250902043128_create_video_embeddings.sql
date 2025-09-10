-- Example: enable the "vector" extension.
create extension vector
with
  schema extensions;

create table public.videos (
  id uuid not null default gen_random_uuid(),
  title text,
  description text,
  transcript_en text,
  mux_asset_id text not null,
  embedding vector(1536) -- This dimension value matches OpenAI text-embedding-3-small
);

alter table public.videos enable row level security;

CREATE UNIQUE INDEX idx_videos_mux_asset_id ON public.videos USING btree (mux_asset_id);

CREATE INDEX idx_videos_embedding_ivfflat ON public.videos
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
