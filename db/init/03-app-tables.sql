-- App-Tabellen, die die Web-App sonst zur Laufzeit "lazy" anlegt.
-- Hier explizit im Init, damit eine FRISCHE Postgres-DB von allein vollständig
-- hochkommt (Anforderung: db/init legt alles an). Alles idempotent.

-- Inhalte aller editierbaren Module (SOPs, Kunden, Konzepte, …) als JSONB.
CREATE TABLE IF NOT EXISTS module_items (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module     text NOT NULL,
    data       jsonb NOT NULL,
    position   double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS module_items_module_idx ON module_items (module);

-- App-Geheimnisse (z. B. Google-OAuth-Tokens). Bewusst getrennt von module_items,
-- damit Tokens NIE in den KI-Kontext geraten.
CREATE TABLE IF NOT EXISTS app_secrets (
    key        text PRIMARY KEY,
    value      jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Hinweis: Standard-Inhalte (Seeds) der Module füllt die App beim ersten Start
-- selbst, sobald ein Modul noch leer ist. Die Tabellen hier sind nur das Gerüst.
