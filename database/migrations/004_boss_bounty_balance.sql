-- Existing encounters retain version 1, their HP, and full legacy rewards.
ALTER TABLE public.active_encounters
    ADD COLUMN balance_version smallint NOT NULL DEFAULT 1 CHECK (balance_version IN (1, 2)),
    ADD COLUMN is_first_clear boolean,
    ADD COLUMN completed_at timestamptz,
    ADD COLUMN rewarded_at timestamptz,
    ADD CONSTRAINT active_encounters_balance_snapshot_check CHECK (balance_version = 1 OR is_first_clear IS NOT NULL);

UPDATE public.active_encounters
SET completed_at = COALESCE(last_updated, created_at),
    rewarded_at = COALESCE(last_updated, created_at)
WHERE status = 'DEFEATED';

CREATE TABLE public.boss_bounty_ledgers (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    earning_day date NOT NULL,
    opportunity_units integer NOT NULL DEFAULT 1000000 CHECK (opportunity_units BETWEEN 0 AND 2000000),
    banked_micros bigint NOT NULL DEFAULT 0 CHECK (banked_micros >= 0),
    remainder_micros integer NOT NULL DEFAULT 0 CHECK (remainder_micros BETWEEN 0 AND 999999),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.boss_bounty_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    source_key text NOT NULL,
    encounter_id uuid REFERENCES public.active_encounters(id) ON DELETE SET NULL,
    quest_id uuid REFERENCES public.quests(id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('PARTICIPATION', 'VICTORY')),
    xp_base integer NOT NULL DEFAULT 0 CHECK (xp_base >= 0),
    earned_micros bigint NOT NULL DEFAULT 0 CHECK (earned_micros >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, source_key)
);
CREATE INDEX boss_bounty_events_user_created_idx ON public.boss_bounty_events (user_id, created_at DESC);
