-- Database functions and triggers
-- Handles automatic timestamp updates and other database-level logic

-- Function to automatically update the updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language 'plpgsql';

-- Triggers to automatically update timestamps on row modifications
create trigger update_mux_assets_updated_at
    before update on "mux"."assets"
    for each row
    execute function update_updated_at_column();

create trigger update_mux_live_streams_updated_at
    before update on "mux"."live_streams"
    for each row
    execute function update_updated_at_column();

create trigger update_mux_uploads_updated_at
    before update on "mux"."uploads"
    for each row
    execute function update_updated_at_column();
