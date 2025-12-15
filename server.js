const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const PORT = 3000;
const SALT_ROUNDS = 10;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key-replace-me-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

db.serialize(() => {
    // Standard Places Table
    db.run(`CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        lat REAL,
        lng REAL,
        description TEXT
    )`);
    
    // NEW: Table to track deleted OSM items
    db.run(`CREATE TABLE IF NOT EXISTS hidden_places (
        id TEXT PRIMARY KEY
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id TEXT,
        action TEXT,
        username TEXT,
        timestamp TEXT,
        details TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);
});

const isAuthenticated = (req, res, next) => {
    if (req.session.user) next();
    else res.status(401).json({ error: 'Unauthorized' });
};

// --- AUTH ROUTES ---
app.post('/auth/register', (req, res) => {
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: 'Missing fields' });
    bcrypt.hash(password, SALT_ROUNDS, (err, hash) => {
        if(err) return res.status(500).json({ error: 'Server error' });
        db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function(err) {
            if (err) return res.status(400).json({ error: 'Username taken' });
            req.session.user = { id: this.lastID, username };
            res.json({ success: true, username });
        });
    });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        bcrypt.compare(password, user.password, (err, result) => {
            if(result) {
                req.session.user = { id: user.id, username: user.username };
                res.json({ success: true, username: user.username });
            } else res.status(401).json({ error: 'Invalid credentials' });
        });
    });
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/auth/me', (req, res) => {
    if(req.session.user) res.json({ loggedIn: true, username: req.session.user.username });
    else res.json({ loggedIn: false });
});

// --- API ROUTES ---

// 1. Get Local Places
app.get('/api/placenames', (req, res) => {
    db.all("SELECT * FROM places", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Get Hidden Places (Blacklist)
app.get('/api/hidden', (req, res) => {
    db.all("SELECT id FROM hidden_places", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.id)); // Returns array of IDs like ['osm-123', 'osm-456']
    });
});

app.post('/api/placenames', isAuthenticated, (req, res) => {
    const { name, category, lat, lng } = req.body;
    const id = `wiki-${Date.now()}`;
    db.run(`INSERT INTO places (id, name, category, lat, lng) VALUES (?, ?, ?, ?, ?)`,
        [id, name, category, lat, lng], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const timestamp = new Date().toISOString();
        db.run(`INSERT INTO history (place_id, action, username, timestamp, details) VALUES (?, ?, ?, ?, ?)`,
            [id, 'CREATE', req.session.user.username, timestamp, `Created ${name}`]);
        res.json({ id, name, category, lat, lng });
    });
});

app.put('/api/placenames/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const { name, category, lat, lng } = req.body;
    
    // Logic: If it's a local update, just update. 
    // If it's an OSM update (conversion), the client usually sends a POST to create new, 
    // but if you want to handle "moving" OSM here, you would essentially insert new and blacklist old.
    // For now, this handles standard local updates.
    db.run(`UPDATE places SET name = ?, category = ?, lat = ?, lng = ? WHERE id = ?`,
        [name, category, lat, lng, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        const timestamp = new Date().toISOString();
        db.run(`INSERT INTO history (place_id, action, username, timestamp, details) VALUES (?, ?, ?, ?, ?)`,
            [id, 'UPDATE', req.session.user.username, timestamp, `Moved/Renamed to ${name}`]);
        res.json({ success: true, id, name, category, lat, lng });
    });
});

// 3. UNIVERSAL DELETE
app.delete('/api/placenames/:id', isAuthenticated, (req, res) => {
    const { id } = req.params;
    const timestamp = new Date().toISOString();
    const username = req.session.user.username;

    if (id.startsWith('osm-')) {
        // IT IS OSM DATA: Add to blacklist (Hidden Table)
        db.run(`INSERT OR IGNORE INTO hidden_places (id) VALUES (?)`, [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Log history
            db.run(`INSERT INTO history (place_id, action, username, timestamp, details) VALUES (?, ?, ?, ?, ?)`,
            [id, 'DELETE', username, timestamp, `Deleted/Hidden OSM Place`]);

            res.json({ success: true, message: "OSM place hidden" });
        });
    } else {
        // IT IS LOCAL DATA: Actually delete it
        db.run(`DELETE FROM places WHERE id = ?`, [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            db.run(`INSERT INTO history (place_id, action, username, timestamp, details) VALUES (?, ?, ?, ?, ?)`,
            [id, 'DELETE', username, timestamp, `Deleted local place`]);

            res.json({ success: true, message: "Local place deleted" });
        });
    }
});

app.get('/api/history/:id', (req, res) => {
    db.all(`SELECT * FROM history WHERE place_id = ? ORDER BY timestamp DESC`, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});