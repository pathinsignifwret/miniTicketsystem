require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({});

// postgresql
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// DB
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Fehler bei der Verbindung zur Datenbank:', err.message);
    } else {
        console.log('Erfolgreich mit PostgreSQL verbunden!');
    }
});

app.use(express.json());

app.use(express.static(path.join(__dirname)));

// analyze ticket with Claude API
async function analyzeTicketWithClaude(problemText) {
    try {
        const prompt = `Du bist ein IT-Support-Assistent. Analysiere folgendes Ticket-Problem: "${problemText}". 
        Gib als Antwort NUR ein valides JSON-Objekt im folgenden Format zurück (ohne Markdown-Formatierung wie \`\`\`json):
        {
          "kategorie": "Eine passende IT-Kategorie auf Deutsch, z. B. IT-Sicherheit / Account, Netzwerk / Infrastruktur, Hardware-Support, Finanzen / Buchhaltung, Allgemein",
          "zusammenfassung": "Eine kurze, prägnante Zusammenfassung des Problems auf Deutsch (maximal 10 Wörter)"
        }`;

        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 150,
            messages: [{ role: "user", content: prompt }]
        });

        const rawText = response.content[0].text;
        const aiResponse = JSON.parse(rawText.trim());

        return {
            kategorie: aiResponse.kategorie || 'Allgemein',
            zusammenfassung: aiResponse.zusammenfassung || problemText
        };
    } catch (err) {
        console.error('Claude API Fehler, nutze Fallback-Logik:', err.message);
        
        // mit vokabel jednefall
        const textLower = problemText.toLowerCase();
        let kategorie = 'Allgemein';
        if (textLower.includes('passwort') || textLower.includes('login') || textLower.includes('anmelden')) {
            kategorie = 'IT-Sicherheit / Account';
        } else if (textLower.includes('internet') || textLower.includes('netzwerk') || textLower.includes('wlan')) {
            kategorie = 'Netzwerk / Infrastruktur';
        } else if (textLower.includes('drucker') || textLower.includes('hardware') || textLower.includes('pc')) {
            kategorie = 'Hardware-Support';
        } else if (textLower.includes('rechnung') || textLower.includes('bezahlen') || textLower.includes('geld')) {
            kategorie = 'Finanzen / Buchhaltung';
        }
        
        const zusammenfassung = problemText.length > 40 ? problemText.substring(0, 37) + '...' : problemText;
        
        return { kategorie, zusammenfassung };
    }
}

// GET: erhalten alle Tickets
app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Fehler bei GET /api/tickets:', err.message);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// tickets create
app.post('/api/tickets', async (req, res) => {
    const { problem, status, prioritaet } = req.body;

    if (!problem || !prioritaet) {
        return res.status(400).json({ error: 'Problem und Priorität sind Pflichtfelder!' });
    }

    try {
        const defaultStatus = status || 'Open';
        const aiAnalysis = await analyzeTicketWithClaude(problem);

        const result = await pool.query(
            'INSERT INTO tickets (problem, status, prioritaet, kategorie, zusammenfassung) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [problem, defaultStatus, prioritaet, aiAnalysis.kategorie, aiAnalysis.zusammenfassung]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Fehler bei POST /api/tickets:', err.message);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// tickets delete
app.delete('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);

        // Überprüfen ob Ticket gelöscht
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden!' });
        }

        res.json({ message: 'Ticket gelöscht' });
    } catch (err) {
        console.error('Fehler bei DELETE /api/tickets/:id:', err.message);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// status ändern
app.put('/api/tickets/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'Status ist erforderlich!' });
    }

    try {
        const result = await pool.query(
            'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden!' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Fehler bei PUT /api/tickets/:id/status:', err.message);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});