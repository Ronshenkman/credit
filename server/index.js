const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize database
async function initDb() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_data (
        id INTEGER PRIMARY KEY,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data JSONB
      );
    `);
        console.log("Database initialized");
    } catch (err) {
        console.error("Error initializing database", err);
    }
}

initDb();

// Get the latest data
app.get('/api/data', async (req, res) => {
    try {
        const result = await pool.query('SELECT uploaded_at, data FROM credit_data WHERE id = 1');
        if (result.rows.length > 0) {
            res.json({
                success: true,
                lastUploadDate: result.rows[0].uploaded_at,
                data: result.rows[0].data
            });
        } else {
            res.json({ success: true, data: null, lastUploadDate: null });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Database error" });
    }
});

// Upload new data
app.post('/api/data', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ success: false, error: "No data provided" });

        await pool.query(
            `INSERT INTO credit_data (id, uploaded_at, data) 
       VALUES (1, CURRENT_TIMESTAMP, $1) 
       ON CONFLICT (id) DO UPDATE SET data = $1, uploaded_at = CURRENT_TIMESTAMP`,
            [JSON.stringify(data)]
        );

        const now = await pool.query('SELECT uploaded_at FROM credit_data WHERE id = 1');

        res.json({ success: true, lastUploadDate: now.rows[0].uploaded_at });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Database error" });
    }
});

// Serve static React app out of webapp/dist
app.use(express.static(path.join(__dirname, '../webapp/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../webapp/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
