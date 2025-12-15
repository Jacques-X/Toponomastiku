var mymap = L.map('mapid', { zoomControl: false, maxZoom: 22, minZoom: 11 }).setView([35.91, 14.45], 13);
L.control.zoom({ position: 'bottomright' }).addTo(mymap);

const renderedIds = new Set();
const searchIndex = [];
let isAddMode = false;

// FeatureGroups
const groups = {
    "Local Council": L.featureGroup().addTo(mymap),
    "Boundaries": L.featureGroup().addTo(mymap),
    "Zone Names": L.featureGroup().addTo(mymap),
    "Place Names": L.featureGroup().addTo(mymap)
};

// Base Layers
const esriLocal = L.tileLayer('/tiles?source=esri&z={z}&x={x}&y={y}', { 
    maxNativeZoom: 19, maxZoom: 22, attribution: 'ESRI | PA' 
}).addTo(mymap);
let currentBase = esriLocal;

window.changeBaseLayer = (val) => {
    mymap.removeLayer(currentBase);
    if (val === 'current') currentBase = esriLocal;
    else currentBase = L.tileLayer.wms('/tiles', { 
        source: 'pa', year: val, format: 'image/png', transparent: true, maxZoom: 20 
    });
    mymap.addLayer(currentBase);
};

// --- LANGUAGE TOGGLE ---
window.toggleLanguage = (lang) => {
    if (lang === 'en') {
        document.body.classList.add('lang-en');
        document.body.classList.remove('lang-mt');
    } else {
        document.body.classList.add('lang-mt');
        document.body.classList.remove('lang-en');
    }
};

// --- RENDER LOGIC ---
function renderLabel(lat, lng, nameMt, nameEn, category, id) {
    if (renderedIds.has(id)) return;
    renderedIds.add(id);
    
    // Add to search index (both names) safely
    if (nameMt) searchIndex.push({ name: nameMt.toLowerCase(), lat, lng });
    if (nameEn && nameEn !== nameMt) searchIndex.push({ name: nameEn.toLowerCase(), lat, lng });

    let sizeClass = 'chip-sm';
    if (category === 'Local Council') sizeClass = 'chip-xl';
    if (category === 'Zone Names') sizeClass = 'chip-md';

    const html = `
        <span class="label-chip ${sizeClass}">
            <span class="text-mt">${nameMt}</span>
            <span class="text-en">${nameEn || nameMt}</span>
        </span>
    `;

    const icon = L.divIcon({
        className: 'custom-label',
        html: html,
        iconSize: null, iconAnchor: null
    });

    const marker = L.marker([lat, lng], {icon, interactive: true});
    marker.bindPopup(`
        <b class="text-mt">${nameMt}</b>
        <b class="text-en">${nameEn || nameMt}</b>
        <br>
        <span style="color:#666;font-size:12px">${category}</span>
    `);
    
    if (groups[category]) marker.addTo(groups[category]);
}

// --- ADD PLACE LOGIC ---
window.toggleAddMode = () => {
    isAddMode = !isAddMode;
    const btn = document.getElementById('fab-add');
    const mapContainer = document.getElementById('mapid');

    if (isAddMode) {
        btn.classList.add('active');
        btn.querySelector('i').className = 'hi-outline hi-x';
        btn.querySelector('.text-mt').innerText = 'Ikkanċella';
        btn.querySelector('.text-en').innerText = 'Cancel';
        mapContainer.classList.add('cursor-crosshair');
    } else {
        btn.classList.remove('active');
        btn.querySelector('i').className = 'hi-outline hi-plus';
        btn.querySelector('.text-mt').innerText = 'Żid Post';
        btn.querySelector('.text-en').innerText = 'Add Place';
        mapContainer.classList.remove('cursor-crosshair');
    }
};

mymap.on('click', (e) => {
    if (!isAddMode) return;
    document.getElementById('new-lat').value = e.latlng.lat;
    document.getElementById('new-lng').value = e.latlng.lng;
    document.getElementById('add-modal').classList.remove('hidden');
    document.getElementById('new-name').value = '';
    document.getElementById('new-name').focus();
});

window.closeModal = () => {
    document.getElementById('add-modal').classList.add('hidden');
};

window.handleFormSubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const category = document.getElementById('new-category').value;
    const lat = parseFloat(document.getElementById('new-lat').value);
    const lng = parseFloat(document.getElementById('new-lng').value);

    try {
        const res = await fetch('/api/placenames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, lat, lng })
        });
        const result = await res.json();
        if (result.success) {
            renderLabel(lat, lng, name, name, category, result.id);
            closeModal();
            toggleAddMode();
        } else {
            alert("Error: " + JSON.stringify(result.error));
        }
    } catch (err) { alert("Network Error"); }
};

// --- DATA FETCHING ---
async function fetchOSM() {
    const bbox = "35.78,14.15,36.10,14.65";
    const q = `[out:json][timeout:60];(rel["boundary"="administrative"]["admin_level"="8"](${bbox});node["place"](${bbox}););out body;>;out skel qt;`;
    
    try {
        const r = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
        const d = await r.json();
        const nodes = {};

        d.elements.forEach(el => {
            if (el.type === 'node') {
                nodes[el.id] = [el.lat, el.lon];
                if (el.tags && el.tags.name) {
                    let cat = "Place Names";
                    if (["city", "town", "village"].includes(el.tags.place)) cat = "Local Council";
                    else if (["suburb", "neighbourhood", "locality"].includes(el.tags.place)) cat = "Zone Names";
                    
                    const nameMt = el.tags['name:mt'] || el.tags.name; 
                    const nameEn = el.tags['name:en'] || el.tags.name;
                    
                    renderLabel(el.lat, el.lon, nameMt, nameEn, cat, 'osm-'+el.id);
                }
            }
        });
        
        d.elements.filter(e => e.type === 'way').forEach(w => {
            const lls = w.nodes.map(id => nodes[id]).filter(n => n);
            if (lls.length > 1) {
                L.polyline(lls, {color: '#38bdf8', weight: 6, opacity: 0.3, lineJoin: 'round'}).addTo(groups["Boundaries"]);
                L.polyline(lls, {color: '#f0f9ff', weight: 1.5, opacity: 0.9, dashArray: '6, 8', lineJoin: 'round'}).addTo(groups["Boundaries"]);
            }
        });
    } catch (e) { console.error("OSM Error:", e); }
}

async function fetchLocalData() {
    try {
        const res = await fetch('/api/placenames');
        const data = await res.json();
        data.forEach(item => renderLabel(item.lat, item.lng, item.name, item.name, item.category, item.id));
    } catch (e) { console.error("Local DB Error:", e); }
}

window.toggleLayer = (n, el) => {
    if (el.checked) mymap.addLayer(groups[n]);
    else mymap.removeLayer(groups[n]);
};

// --- SEARCH LISTENER (RESTORED) ---
document.getElementById('map-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.toLowerCase();
        if (!val) return;
        const res = searchIndex.find(i => i.name.includes(val));
        if (res) {
            mymap.flyTo([res.lat, res.lng], 17, {duration: 1.5});
        }
    }
});

mymap.whenReady(() => { fetchOSM(); fetchLocalData(); });