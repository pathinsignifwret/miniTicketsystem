require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = 3000;

// mit andere adresse verbinden
app.use(cors());
app.use(express.json());

// postgresql
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

// DB
pool.connect((err) => {
    if (err) {
        console.error('Verbindungsfehler zur Datenbank:', err.stack);
    } else {
        console.log('Erfolgreich mit PostgreSQL verbunden!');
    }
});

// tickets 
app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets ORDER BY erstellungsdatum DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// tickets create
app.post('/api/tickets', async (req, res) => {
    const { problem, status, prioritaet } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO tickets (problem, status, prioritaet) VALUES ($1, $2, $3) RETURNING *',
            [problem, status, prioritaet]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// tickets delete
app.delete('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
        res.json({ message: 'Ticket gelöscht' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// status ändern
app.put('/api/tickets/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // neue status in arbeit; offen oder geschlossen

    try {
        const result = await pool.query(
            'UPDATE tickets SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden' });
        }

        res.json(result.rows[0]); // back to updated ticket
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Serverfehler' });
    }
});

// server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});