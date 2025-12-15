const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'tile_cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

const BBOX = { minLat: 35.78, maxLat: 36.10, minLon: 14.15, maxLon: 14.65 };
const CONCURRENCY = 20; 

function lon2tile(lon, zoom) { return Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); }
function lat2tile(lat, zoom) { return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)); }

async function downloadTile(z, x, y) {
    const fileName = `esri_${z}_${x}_${y}.jpg`;
    const filePath = path.join(CACHE_DIR, fileName);

    // --- SMART CHECK: Skip only if file exists AND is not empty ---
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 0) return "skipped";
        }
    } catch (err) {
        // Continue to download if check fails
    }

    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    try {
        const res = await axios({ method: 'get', url, responseType: 'arraybuffer', timeout: 8000 });
        fs.writeFileSync(filePath, res.data);
        return "downloaded";
    } catch (e) {
        return "error";
    }
}

async function run() {
    const tasks = [];
    console.log("🔍 Scanning Malta grid for missing frames...");

    for (let z = 12; z <= 19; z++) {
        const xMin = lon2tile(BBOX.minLon, z);
        const xMax = lon2tile(BBOX.maxLon, z);
        const yMin = lat2tile(BBOX.maxLat, z);
        const yMax = lat2tile(BBOX.minLat, z);

        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                tasks.push({z, x, y});
            }
        }
    }

    const total = tasks.length;
    let completed = 0;
    let downloadedCount = 0;
    let skippedCount = 0;

    console.log(`🚀 Starting Sync: ${total} total frames to verify.`);

    const workers = Array(CONCURRENCY).fill(0).map(async () => {
        while (tasks.length > 0) {
            const task = tasks.pop();
            const result = await downloadTile(task.z, task.x, task.y);
            
            completed++;
            if (result === "downloaded") downloadedCount++;
            if (result === "skipped") skippedCount++;

            if (completed % 50 === 0 || completed === total) {
                const percent = ((completed / total) * 100).toFixed(1);
                process.stdout.write(`\rProgress: ${percent}% | Verified: ${completed} | New: ${downloadedCount} | Skipped: ${skippedCount}`);
            }
        }
    });

    await Promise.all(workers);
    console.log("\n\n✅ Local Map Server is fully synchronized!");
    console.log(`📁 Total files in cache: ${skippedCount + downloadedCount}`);
}

run();
