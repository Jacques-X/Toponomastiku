require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();

const PORT = 3000;
const CACHE_DIR = path.join(__dirname, 'tile_cache');
const db = new sqlite3.Database('./map_data.db');

app.use(express.json());
app.use(express.static('public'));

// --- HYBRID TILE ENGINE ---
app.get('/tiles', async (req, res) => {
    const { source, year, z, x, y, bbox, width, height } = req.query;

    if (source === 'esri') {
        // STRICT LOCAL: Serve only from disk
        const fileName = `esri_${z}_${x}_${y}.jpg`;
        const filePath = path.join(CACHE_DIR, fileName);
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
        return res.status(404).send('Esri tile not in local cache');
    } 
    
    if (source === 'pa') {
        // REAL-TIME: Proxy call to Planning Authority Servers
        const remoteUrl = year === '1896' 
            ? "https://geohub.gov.mt/arcgis/services/NSDI/Joint_Ordnance_Survey_1896/MapServer/WMSServer"
            : `https://malta.coverage.wetransform.eu/wms/ortho_${year}/ows`;
        
        const layerName = year === '1896' ? '0' : `ortho_${year}`;

        try {
            const response = await axios({
                method: 'get',
                url: remoteUrl,
                params: {
                    service: 'WMS', request: 'GetMap', version: '1.3.0',
                    layers: layerName, crs: 'EPSG:3857', bbox: bbox,
                    width: width, height: height, format: 'image/png',
                    transparent: 'true', styles: ''
                },
                responseType: 'arraybuffer',
                timeout: 8000
            });
            res.set('Content-Type', 'image/png');
            return res.send(response.data);
        } catch (error) {
            return res.status(502).send('PA Service Offline');
        }
    }
});

// Wiki Endpoints
app.get('/api/placenames', (req, res) => {
    db.all("SELECT * FROM placenames ORDER BY name ASC", [], (err, rows) => res.json(rows || []));
});

app.listen(PORT, () => console.log(`🚀 Hybrid Server: http://localhost:${PORT}`));
