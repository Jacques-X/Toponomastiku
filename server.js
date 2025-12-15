require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const { validatePlacename } = require('./src/middleware/validate');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = path.join(__dirname, 'tile_cache');
const db = new sqlite3.Database(process.env.DB_PATH || './map_data.db');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- TILE ENGINE SERVICE ---
app.get('/tiles', async (req, res) => {
    const { source, year, z, x, y, bbox, width, height } = req.query;

    if (source === 'esri') {
        const filePath = path.join(CACHE_DIR, `esri_${z}_${x}_${y}.jpg`);
        return fs.existsSync(filePath) ? res.sendFile(filePath) : res.status(404).send('Offline');
    }

    if (source === 'pa') {
        const remoteUrl = year === '1896' 
            ? "https://geohub.gov.mt/arcgis/services/NSDI/Joint_Ordnance_Survey_1896/MapServer/WMSServer"
            : "https://pamapserver.pa.org.mt/arcgis/services/MapServer/WMSServer";
        
        try {
            const response = await axios({
                method: 'get', url: remoteUrl,
                params: {
                    service: 'WMS', request: 'GetMap', version: '1.3.0',
                    layers: year === '1896' ? '0' : `Orthos_${year}`,
                    crs: 'EPSG:3857', bbox, width, height,
                    format: 'image/png', transparent: 'true'
                },
                responseType: 'arraybuffer', timeout: 8000
            });
            res.set('Content-Type', 'image/png');
            return res.send(response.data);
        } catch (e) { res.status(502).send('PA Service Down'); }
    }
});

// --- API ROUTES ---
app.get('/api/placenames', (req, res) => {
    db.all("SELECT * FROM placenames", [], (err, rows) => res.json(rows || []));
});

app.post('/api/placenames', validatePlacename, (req, res) => {
    const { name, category, lat, lng } = req.body;
    const id = "wiki-" + Date.now();
    db.run(`INSERT INTO placenames (id, name, category, lat, lng) VALUES (?, ?, ?, ?, ?)`,
        [id, name, category, lat, lng], 
        (err) => err ? res.status(500).json({error: err.message}) : res.json({success: true, id})
    );
});

app.listen(PORT, () => console.log(`🚀 Modular Server running on http://localhost:${PORT}`));
