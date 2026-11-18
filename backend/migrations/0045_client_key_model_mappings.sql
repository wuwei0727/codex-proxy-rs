ALTER TABLE client_api_keys ADD COLUMN model_mappings_json jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(model_mappings_json) = 'object');
