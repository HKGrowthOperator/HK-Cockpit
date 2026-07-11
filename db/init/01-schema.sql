-- Magical Wall — Schema der "Single Source of Truth"
-- Läuft im Init gegen die Datenbank "cockpit".

-- ── Kerntabelle: jede Automation meldet hier Start & Ende ────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation  text        NOT NULL,                 -- Name der Automation
    trigger     text        NOT NULL DEFAULT 'manual',-- manual | webhook | schedule | event
    status      text        NOT NULL DEFAULT 'running'-- running | success | error
                            CHECK (status IN ('running','success','error')),
    started_at  timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    tokens_in   integer     NOT NULL DEFAULT 0,
    tokens_out  integer     NOT NULL DEFAULT 0,
    cost_eur    numeric(10,4) NOT NULL DEFAULT 0,
    summary     text,                                  -- 1-Satz-Ergebnis vom Agent
    output      text,                                  -- voller Output (Agenten-Bibliothek)
    error       text
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_started   ON agent_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status    ON agent_runs (status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_automation ON agent_runs (automation);

-- Dauer in Sekunden als praktische berechnete Spalte
CREATE OR REPLACE VIEW v_runs AS
SELECT *,
       EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at)) AS duration_sec
FROM   agent_runs;

-- ── Kennzahlen für die Wand (eine View pro Kachel/Chart) ─────────────────────

-- Kachel: Läufe heute
CREATE OR REPLACE VIEW v_runs_today AS
SELECT count(*) AS runs_today
FROM   agent_runs
WHERE  started_at >= date_trunc('day', now());

-- Kachel: Erfolgsquote (letzte 7 Tage), in Prozent
CREATE OR REPLACE VIEW v_success_rate_7d AS
SELECT round(100.0 * count(*) FILTER (WHERE status = 'success')
            / NULLIF(count(*) FILTER (WHERE status IN ('success','error')), 0), 1) AS success_rate_pct
FROM   agent_runs
WHERE  started_at >= now() - interval '7 days';

-- Kachel: Kosten diesen Monat (EUR)
CREATE OR REPLACE VIEW v_cost_month AS
SELECT COALESCE(sum(cost_eur), 0) AS cost_eur_month
FROM   agent_runs
WHERE  started_at >= date_trunc('month', now());

-- Kachel: offene Fehler (Läufe mit Status error, letzte 7 Tage)
CREATE OR REPLACE VIEW v_open_errors AS
SELECT count(*) AS open_errors
FROM   agent_runs
WHERE  status = 'error'
  AND  started_at >= now() - interval '7 days';

-- Chart: Läufe & Kosten pro Tag (letzte 30 Tage)
CREATE OR REPLACE VIEW v_daily_trend AS
SELECT date_trunc('day', started_at)::date AS day,
       count(*)                            AS runs,
       count(*) FILTER (WHERE status = 'error') AS errors,
       sum(cost_eur)                       AS cost_eur
FROM   agent_runs
WHERE  started_at >= now() - interval '30 days'
GROUP  BY 1
ORDER  BY 1;

-- Tabelle: letzte 20 Läufe
CREATE OR REPLACE VIEW v_recent_runs AS
SELECT automation,
       trigger,
       status,
       started_at,
       round(EXTRACT(EPOCH FROM (COALESCE(finished_at, now()) - started_at))::numeric, 1) AS duration_sec,
       cost_eur,
       summary,
       error
FROM   agent_runs
ORDER  BY started_at DESC
LIMIT  20;
