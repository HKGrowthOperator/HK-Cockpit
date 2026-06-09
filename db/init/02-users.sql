-- Benutzer der App (für den Login). Läuft im Init gegen die "cockpit"-DB.
-- Passwörter werden NIE im Klartext gespeichert, nur als bcrypt-Hash.
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
