const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const app = express();
const db = new sqlite3.Database('./map_data.db');

app.use(express.json());
app.use(express.static('public'));

const CACHE_DIR = path.join(__dirname, 'tile_cache');

// --- THE LOCAL TILE ENGINE ---
app.get('/local-tiles', (req, res) => {
    const { z, x, y } = req.query;
    const fileName = `esri_${z}_${x}_${y}.jpg`;
    const filePath = path.join(CACHE_DIR, fileName);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('Tile not in local cache');
    }
});

// Wiki Endpoints with unique ID logic
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS placenames (
        id TEXT PRIMARY KEY, 
        name TEXT, 
        category TEXT, 
        lat REAL, 
        lng REAL, 
        username TEXT
    )`);
});

app.get('/api/placenames', (req, res) => {
    db.all("SELECT * FROM placenames", [], (err, rows) => res.json(rows || []));
});

app.post('/api/placenames', (req, res) => {
    const { name, category, lat, lng } = req.body;
    const id = "wiki-" + Date.now();
    db.run(`INSERT OR IGNORE INTO placenames (id, name, category, lat, lng, username) VALUES (?, ?, ?, ?, ?, 'User')`, 
    [id, name, category, lat, lng], () => res.json({ success: true }));
});

app.listen(3000, () => console.log('🚀 Local Malta Wiki Server: http://localhost:3000'));
