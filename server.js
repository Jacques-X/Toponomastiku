const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const app = express();
const db = new sqlite3.Database('./map_data.db');

app.use(express.json());
app.use(express.static('public'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS placenames (
        id TEXT PRIMARY KEY, 
        name TEXT, category TEXT, lat REAL, lng REAL, username TEXT
    )`);

    db.get("SELECT COUNT(*) as count FROM placenames", (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding Malta from OSM...");
            seedOSM();
        } else {
            console.log("Database loaded with " + row.count + " labels.");
        }
    });
});

async function seedOSM() {
    const bbox = "35.78,14.15,36.10,14.65";
    const q = `[out:json][timeout:60];(node["place"~"city|town|village|suburb|neighbourhood|locality|hamlet"](${bbox}););out body;`;
    try {
        const res = await axios.get("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
        const stmt = db.prepare("INSERT OR IGNORE INTO placenames (id, name, category, lat, lng, username) VALUES (?, ?, ?, ?, ?, 'OSM')");
        res.data.elements.forEach(el => {
            if (el.tags && el.tags.name) {
                let cat = "Place Names";
                if (["city", "town", "village"].includes(el.tags.place)) cat = "Local Council";
                else if (["suburb", "neighbourhood", "locality"].includes(el.tags.place)) cat = "Zone Names";
                stmt.run(el.id.toString(), el.tags.name, cat, el.lat, el.lon);
            }
        });
        stmt.finalize();
        console.log("✅ Seed complete.");
    } catch (e) { console.error("OSM Seed failed."); }
}

app.get('/api/placenames', (req, res) => {
    db.all("SELECT * FROM placenames", [], (err, rows) => res.json(rows || []));
});

app.post('/api/placenames', (req, res) => {
    const { name, category, lat, lng } = req.body;
    const id = "wiki-" + Date.now();
    db.run(`INSERT INTO placenames (id, name, category, lat, lng, username) VALUES (?, ?, ?, ?, ?, 'User')`, 
    [id, name, category, lat, lng], () => res.json({ id }));
});

app.listen(3000, () => console.log('🚀 Server: http://localhost:3000'));
