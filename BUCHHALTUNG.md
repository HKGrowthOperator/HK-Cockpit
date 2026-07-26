# Buchhaltung im HK Cockpit

Doppelte Buchführung nach SKR03/SKR04, direkt im Cockpit unter **/buchhaltung**.

## Was das System kann

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Einnahmen, Ausgaben, Ergebnis, Liquidität, offene Forderungen und Verbindlichkeiten, USt-Zahllast, Jahresverlauf als Grafik |
| **Buchungen** | Erfassung in Alltagssprache („Ausgangsrechnung", „Ausgabe direkt bezahlt") — der Buchungssatz Soll/Haben wird daraus gebildet und angezeigt |
| **Belege** | Upload per Datei oder Drag-and-drop, dazu automatischer Eingang aus E-Mail und Google Drive |
| **Bank** | Kontoauszug als CSV einlesen, Zahlungen werden offenen Rechnungen automatisch zugeordnet |
| **Auswertungen** | GuV nach Gruppen, Summen- und Saldenliste, Umsatzsteuer-Voranmeldung je Monat/Quartal |
| **Export** | DATEV-Buchungsstapel (EXTF) für den Steuerberater, alternativ einfaches CSV |

## Grundlagen

**Doppelte Buchführung.** Jede Buchung hat ein Soll- und ein Habenkonto. Das
Formular fragt nicht nach Konten, sondern nach dem Vorgang; der Buchungssatz
wird gebildet und *sichtbar* angezeigt — nachvollziehbar statt Blackbox.

**Beträge in Cent.** Intern wird ausschließlich in ganzen Cent gerechnet, damit
keine Rundungsfehler entstehen.

**GoBD.** Buchungen werden nie gelöscht, sondern per Gegenbuchung storniert.
Buchungs- und Belegnummern laufen lückenlos fort. Belegdateien liegen
unveränderbar im Volume `beleg_archiv` (Pfad `/data/belege`, nach Jahr/Monat),
je Datei wird ein SHA-256-Hash gespeichert.

**Kontenrahmen.** SKR03 und SKR04 sind als praxisnaher Auszug hinterlegt
(die Konten, die eine Agentur tatsächlich bebucht). Eigene Konten lassen sich
jederzeit in der Tabelle `konten` ergänzen, ohne Code-Änderung. Umgestellt wird
in `buchhaltung_einstellungen.kontenrahmen`.

## Belege automatisch hereinbekommen

### Per E-Mail (n8n)

Workflow in n8n: **E-Mail-Trigger (IMAP)** → **HTTP Request** an das Cockpit.

```
POST http://<cockpit-web>:3000/api/buchhaltung/ingest
Header: x-automation-secret: <AUTOMATION_INGEST_SECRET>

{
  "quelle": "email",
  "typ": "eingangsrechnung",
  "betreff": "{{ $json.subject }}",
  "absender": "{{ $json.from }}",
  "text": "{{ $json.text }}",
  "quelle_id": "{{ $json.messageId }}",
  "datei": {
    "name": "{{ $binary.attachment_0.fileName }}",
    "mime": "{{ $binary.attachment_0.mimeType }}",
    "base64": "{{ $binary.attachment_0.data }}"
  }
}
```

Datum, Betrag und Absender werden aus dem Text gelesen, wenn sie nicht
mitgeliefert werden. Dieselbe Mail zweimal zugestellt → nur ein Beleg
(Erkennung über Datei-Hash bzw. `quelle_id`).

### Aus Google Drive

Gleicher Endpunkt mit `"quelle": "drive"` und der Drive-Datei-ID als
`quelle_id`. In n8n: **Google Drive Trigger** (neue Datei im Belegordner) →
Datei laden → HTTP Request wie oben.

### Bankumsätze

Kontoauszug im Online-Banking als CSV exportieren und unter
**Buchhaltung → Bank** hochladen. Die Spalten werden anhand der Überschriften
erkannt (Sparkasse, Volksbank, DKB, N26, Commerzbank und ähnliche Formate),
Datum und Betrag auch im deutschen Zahlenformat. Derselbe Auszug zweimal
hochgeladen → keine Dubletten.

Die Zuordnung zu offenen Rechnungen läuft dreistufig:
1. Rechnungsnummer im Verwendungszweck → Sicherheit 100 %
2. Betrag *und* Name passen → 90 %
3. Betrag passt und ist eindeutig → 65 % (bitte prüfen)

Bestätigt wird immer von Hand — das System schlägt vor, es entscheidet nicht.

## Erforderliche Einstellungen

| Variable | Zweck |
|---|---|
| `AUTOMATION_INGEST_SECRET` | Schützt den Beleg-Eingang. **Ohne diesen Wert ist der Endpunkt in Produktion geschlossen** (503). Erzeugen mit `openssl rand -hex 32` |
| `BELEG_PFAD` | Ablageort der Belegdateien, Standard `/data/belege` (im Compose als Volume gemountet) |

## Aufbau im Code

```
web/lib/accounting/
  types.ts          Datentypen (Buchung, Beleg, Konto, Bankumsatz)
  kontenrahmen.ts   SKR03/SKR04 + Kontierungsvorschläge aus Belegtexten
  db.ts             Schema (wird bei Bedarf angelegt) und Datenzugriff
  buchen.ts         reine Rechen-/Prüflogik (auch im Browser nutzbar)
  service.ts        Buchen mit Datenbankzugriff (nur Server)
  auswertung.ts     GuV, Summen/Salden, UStVA, Kennzahlen, Monatsverlauf
  bank-csv.ts       CSV einlesen und Zahlungen zuordnen
  belege-datei.ts   Dateiablage, Betrag/Datum aus Text lesen
  datev.ts          DATEV-EXTF- und CSV-Export
  laden.ts          sammelt die Daten für die Seiten

web/app/(dashboard)/buchhaltung/   Übersicht, Buchungen, Belege, Bank, Auswertungen
web/app/api/buchhaltung/           buchungen, belege, bank-import, ingest, export
```

## Grenzen

Das System bereitet die Buchhaltung auf und macht sie prüfbar — es ersetzt
**nicht** den Steuerberater. Die Umsatzsteuer-Voranmeldung wird berechnet und
angezeigt, aber nicht an ELSTER übermittelt. Jahresabschluss, Abschreibungs-
pläne und Bilanz bleiben Sache der Kanzlei; dafür gibt es den DATEV-Export.
