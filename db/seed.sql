-- Demo-Daten, damit die Wand sofort etwas zeigt.
-- Manuell einspielen (NICHT im Init, damit Produktivdaten sauber bleiben):
--   docker compose exec -T postgres psql -U cockpit -d cockpit < db/seed.sql

INSERT INTO agent_runs (automation, trigger, status, started_at, finished_at, tokens_in, tokens_out, cost_eur, summary, error)
SELECT
    (ARRAY['Posteingang zusammenfassen','Täglicher KPI-Report','Lead-Anreicherung','Rechnungs-Check'])[1 + floor(random()*4)::int],
    (ARRAY['schedule','webhook','manual','event'])[1 + floor(random()*4)::int],
    CASE WHEN random() < 0.12 THEN 'error' ELSE 'success' END                              AS status,
    now() - (random()*interval '14 days')                                                  AS started_at,
    NULL, 0, 0, 0, NULL, NULL
FROM generate_series(1, 120) g;

-- Felder konsistent nachziehen (Ende, Tokens, Kosten, Texte)
UPDATE agent_runs
SET finished_at = started_at + (random()*interval '90 seconds'),
    tokens_in   = 500 + floor(random()*4000)::int,
    tokens_out  = 200 + floor(random()*1500)::int,
    cost_eur    = round((0.01 + random()*0.20)::numeric, 4),
    summary     = CASE WHEN status = 'success'
                       THEN 'Lauf erfolgreich abgeschlossen.'
                       ELSE NULL END,
    error       = CASE WHEN status = 'error'
                       THEN 'Timeout beim externen API-Aufruf.'
                       ELSE NULL END
WHERE finished_at IS NULL;
