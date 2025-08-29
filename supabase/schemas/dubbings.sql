-- Dubbings table to track ElevenLabs dubbing jobs and prevent duplicates
CREATE TABLE IF NOT EXISTS public.dubbings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mux_asset_id TEXT NOT NULL,
    target_language TEXT NOT NULL,
    elevenlabs_job_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'dubbed', 'failed', 'timeout')),
    audio_url TEXT,
    mux_track_id TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one dubbing per asset per language
    UNIQUE(mux_asset_id, target_language)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_dubbings_mux_asset_id ON public.dubbings(mux_asset_id);
CREATE INDEX IF NOT EXISTS idx_dubbings_status ON public.dubbings(status);
CREATE INDEX IF NOT EXISTS idx_dubbings_elevenlabs_job_id ON public.dubbings(elevenlabs_job_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_dubbings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set completed_at when status changes to completed states
    IF NEW.status IN ('dubbed', 'failed', 'timeout') AND OLD.status NOT IN ('dubbed', 'failed', 'timeout') THEN
        NEW.completed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
DROP TRIGGER IF EXISTS trigger_update_dubbings_updated_at ON public.dubbings;
CREATE TRIGGER trigger_update_dubbings_updated_at
    BEFORE UPDATE ON public.dubbings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_dubbings_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE public.dubbings ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access (for edge functions)
DROP POLICY IF EXISTS "Service role can manage dubbings" ON public.dubbings;
CREATE POLICY "Service role can manage dubbings"
    ON public.dubbings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy for authenticated users to read dubbings (optional)
DROP POLICY IF EXISTS "Authenticated users can read dubbings" ON public.dubbings;
CREATE POLICY "Authenticated users can read dubbings"
    ON public.dubbings
    FOR SELECT
    TO authenticated
    USING (true);