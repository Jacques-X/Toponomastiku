const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'tile_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

// Malta Bounding Box
const BBOX = { minLat: 35.78, maxLat: 36.10, minLon: 14.15, maxLon: 14.65 };

// Convert Lat/Lon to Tile X/Y
function lon2tile(lon, zoom) { return Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); }
function lat2tile(lat, zoom) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)); }

async function downloadTile(z, x, y) {
    const fileName = `esri_${z}_${x}_${y}.jpg`;
    const filePath = path.join(CACHE_DIR, fileName);

    if (fs.existsSync(filePath)) return; // Skip if already downloaded

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    try {
        const res = await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 5000 });
        fs.writeFileSync(filePath, res.data);
        process.stdout.write('.'); // Progress dot
    } catch (e) {
        console.log(`\nFailed: ${z}/${x}/${y}`);
    }
}

async function run() {
    console.log("🚀 Starting Bulk Download for Malta (Zoom 12-18)...");
    for (let z = 12; z <= 18; z++) {
        const xMin = lon2tile(BBOX.minLon, z);
        const xMax = lon2tile(BBOX.maxLon, z);
        const yMin = lat2tile(BBOX.maxLat, z);
        const yMax = lat2tile(BBOX.minLat, z);

        console.log(`\nZoom ${z}: ${(xMax - xMin + 1) * (yMax - yMin + 1)} tiles`);
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                await downloadTile(z, x, y);
            }
        }
    }
    console.log("\n✅ Malta is now fully cached for offline use!");
}

run();
