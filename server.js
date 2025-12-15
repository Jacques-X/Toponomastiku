require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = path.join(__dirname, 'tile_cache');
const db = new sqlite3.Database(process.env.DB_PATH || './map_data.db');

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Hybrid Tile Engine
app.get('/tiles', async (req, res) => {
    const { source, year, z, x, y, bbox, width, height } = req.query;

    if (source === 'esri') {
        const fileName = `esri_${z}_${x}_${y}.jpg`;
        const filePath = path.join(CACHE_DIR, fileName);
        if (fs.existsSync(filePath)) return res.sendFile(filePath);
        return res.status(404).send('Tile not in local cache');
    }

    if (source === 'pa') {
        const remoteUrl = year === '1896' 
            ? "https://geohub.gov.mt/arcgis/services/NSDI/Joint_Ordnance_Survey_1896/MapServer/WMSServer"
            : `https://pamapserver.pa.org.mt/arcgis/services/MapServer/WMSServer`;
        
        const layerName = year === '1896' ? '0' : `Orthos_${year}`;

        try {
            const response = await axios({
                method: 'get', url: remoteUrl,
                params: {
                    service: 'WMS', request: 'GetMap', version: '1.3.0',
                    layers: layerName, crs: 'EPSG:3857', bbox, width, height,
                    format: 'image/png', transparent: 'true', styles: ''
                },
                responseType: 'arraybuffer', timeout: 10000
            });
            res.set('Content-Type', 'image/png');
            return res.send(response.data);
        } catch (e) { res.status(502).send('PA Offline'); }
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS placenames (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, 
        lat REAL NOT NULL, lng REAL NOT NULL, username TEXT DEFAULT 'User'
    )`);
});

app.get('/api/placenames', (req, res) => db.all("SELECT * FROM placenames", [], (e, r) => res.json(r || [])));
app.post('/api/placenames', (req, res) => {
    const { name, category, lat, lng } = req.body;
    db.run(`INSERT INTO placenames (id, name, category, lat, lng) VALUES (?, ?, ?, ?, ?)`,
        ["wiki-"+Date.now(), name, category, lat, lng], () => res.json({success:true}));
});

app.listen(PORT, () => console.log(`🚀 Hybrid Server: http://localhost:${PORT}`));
