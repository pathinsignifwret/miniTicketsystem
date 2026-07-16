# Mini-Ticket-System 🎟️

Das ist ein einfaches Ticket-System. Hier kann man Support-Tickets erstellen und verwalten.

## Was kann das System? (Features)
* **Tickets erstellen:** Schreiben Sie ein Problem und wählen Sie die Priorität (Niedrig, Normal, Hoch).
* **Status ändern:** Sie können den Status ändern (*Offen*, *In Arbeit*, *Fertig*).
* **Farben:** Jeder Status hat eine eigene Farbe (Rot, Gelb oder Grün).
* **Speichern:** Alle Tickets bleiben in der PostgreSQL-Datenbank gespeichert.

## Technologien
* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Node.js, Express
* **Datenbank:** PostgreSQL

## Wie startet man das Projekt? (Installation)

1. **Repository kopieren:**
   ```bash
   git clone [https://github.com/pathinsignifwret/miniTicketsystem.git](https://github.com/pathinsignifwret/miniTicketsystem.git)
   cd miniTicketsystem

2. **Bibliotheken installieren:**
    ```bash
    npm instal

3. **Datenbank erstellen:**

    CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    problem TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Offen',
    prioritaet VARCHAR(20) NOT NULL,
    erstellungsdatum TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

4. **Server starten:**
    ```bash
    node server.js