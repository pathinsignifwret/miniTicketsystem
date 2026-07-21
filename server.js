require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CORS: Erlaube Anfragen von allen Seiten (z.B. Live Server)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. JSON und Statische Dateien senden
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 3. Anthropic SDK
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

// 4. Verbindung mit PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Fehler bei der Verbindung mit der Datenbank:', err.message);
    } else {
        console.log('Verbindung zur Datenbank war erfolgreich!');
    }
});

// 5. AI Ticket Prüfung mit Claude oder Notfall-Logik
async function analyzeTicketWithClaude(problemText) {
    try {
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('dummy')) {
            throw new Error('Kein API-Schlüssel. Nutze einfache Logik.');
        }

        const prompt = `Du bist ein IT-Support-Assistent. Analysiere folgendes Ticket-Problem: "${problemText}". 
        Gib als Antwort NUR ein valides JSON-Objekt im folgenden Format zurück (ohne Markdown):
        {
          "kategorie": "IT-Sicherheit / Account, Netzwerk / Infrastruktur, Hardware-Support, Finanzen / Buchhaltung, oder Allgemein",
          "zusammenfassung": "Kurze Zusammenfassung des Problems (bis zu 10 Wörter)"
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
        console.warn('⚠️ API-Fehler (Einfache Logik wird genutzt):', err.message);
        
        const textLower = problemText.toLowerCase();
        let kategorie = 'Allgemein';
        if (textLower.includes('passwort') || textLower.includes('login')) {
            kategorie = 'IT-Sicherheit / Account';
        } else if (textLower.includes('internet') || textLower.includes('wlan')) {
            kategorie = 'Netzwerk / Infrastruktur';
        } else if (textLower.includes('drucker') || textLower.includes('pc')) {
            kategorie = 'Hardware-Support';
        }
        
        const zusammenfassung = problemText.length > 35 ? problemText.substring(0, 32) + '...' : problemText;
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
        res.status(500).json({ error: 'Serverfehler. Bitte später versuchen.' });
    }
});

// tickets create
app.post('/api/tickets', async (req, res) => {
    const { problem, status, prioritaet } = req.body;

    if (!problem || !prioritaet) {
        return res.status(400).json({ error: 'Problem und Priorität sind wichtig!' });
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

// 7. Server starten
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server läuft auf http://127.0.0.1:${PORT}`);
});