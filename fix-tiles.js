const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'tile_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

const BBOX = { minLat: 35.78, maxLat: 36.10, minLon: 14.15, maxLon: 14.65 };

function lon2tile(lon, zoom) { return Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); }
function lat2tile(lat, zoom) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)); }

async function downloadTile(z, x, y) {
    const fileName = `esri_${z}_${x}_${y}.jpg`;
    const filePath = path.join(CACHE_DIR, fileName);

    // KEY FIX: Only download if file doesn't exist OR is 0 bytes
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return false;

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    try {
        const res = await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 8000 });
        fs.writeFileSync(filePath, res.data);
        return true;
    } catch (e) {
        return "error";
    }
}

async function run() {
    console.log("🔍 Checking for missing Malta tiles...");
    let downloaded = 0;
    let skipped = 0;
    let errors = 0;

    for (let z = 12; z <= 19; z++) {
        const xMin = lon2tile(BBOX.minLon, z);
        const xMax = lon2tile(BBOX.maxLon, z);
        const yMin = lat2tile(BBOX.maxLat, z);
        const yMax = lat2tile(BBOX.minLat, z);

        process.stdout.write(`\nZoom ${z}: `);
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                const result = await downloadTile(z, x, y);
                if (result === true) {
                    downloaded++;
                    process.stdout.write('+'); // New tile downloaded
                } else if (result === false) {
                    skipped++;
                } else {
                    errors++;
                    process.stdout.write('x'); // Failed attempt
                }
            }
        }
    }
    console.log(`\n\n🏁 Verification Complete!`);
    console.log(`✅ Existing Tiles: ${skipped}`);
    console.log(`📥 New Tiles Added: ${downloaded}`);
    console.log(`❌ Failed: ${errors}`);
}

run();
