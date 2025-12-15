var mymap = L.map('mapid', { zoomControl: false, maxZoom: 22, zoomSnap: 1 }).setView([35.91, 14.45], 13);
L.control.zoom({ position: 'bottomright' }).addTo(mymap);

const renderedIds = new Set();
const searchIndex = [];
const groups = {
    "Local Council": new L.LayerGroup().addTo(mymap),
    "Boundaries": new L.LayerGroup().addTo(mymap),
    "Zone Names": new L.LayerGroup().addTo(mymap),
    "Place Names": new L.LayerGroup().addTo(mymap)
};

const esriLocal = L.tileLayer('/tiles?source=esri&z={z}&x={x}&y={y}', { maxNativeZoom: 19, maxZoom: 22 }).addTo(mymap);
let currentBase = esriLocal;

window.changeBaseLayer = (val) => {
    mymap.removeLayer(currentBase);
    if (val === 'current') currentBase = esriLocal;
    else currentBase = L.tileLayer.wms('/tiles', { source: 'pa', year: val, format: 'image/png', transparent: true, maxZoom: 20 });
    mymap.addLayer(currentBase);
};

function renderLabel(lat, lng, text, category, id) {
    if (renderedIds.has(id)) return;
    searchIndex.push({ name: text.toLowerCase(), lat, lng });
    const sizes = { "Local Council": "16px", "Zone Names": "13px", "Place Names": "11px" };
    const icon = L.divIcon({ 
        className: 'custom-label', 
        html: `<span style="font-size:${sizes[category] || '11px'}">${text}</span>`, 
        iconSize: [200, 40], iconAnchor: [100, 20] 
    });
    L.marker([lat, lng], {icon, interactive: false}).addTo(groups[category] || groups["Place Names"]);
    renderedIds.add(id);
}

document.getElementById('map-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const res = searchIndex.find(i => i.name.includes(e.target.value.toLowerCase()));
        if (res) mymap.flyTo([res.lat, res.lng], 18);
    }
});

async function load() {
    const res = await fetch('/api/placenames');
    const data = await res.json();
    data.forEach(d => renderLabel(d.lat, d.lng, d.name, d.category, 'db-'+d.id));
    fetchOSM();
}

async function fetchOSM() {
    const bbox = "35.78,14.15,36.10,14.65";
    const q = `[out:json][timeout:30];(rel["boundary"="administrative"]["admin_level"="8"](${bbox});node["place"](${bbox}););out body;>;out skel qt;`;
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
                    renderLabel(el.lat, el.lon, el.tags.name, cat, 'osm-'+el.id);
                }
            }
        });
        d.elements.filter(e => e.type === 'way').forEach(w => {
            const lls = w.nodes.map(id => nodes[id]).filter(n => n);
            if (lls.length > 1) L.polyline(lls, {color:'#fff', weight:1.5, opacity:0.6, dashArray:'2,6'}).addTo(groups["Boundaries"]);
        });
    } catch (e) {}
}

window.toggleLayer = (n, el) => el.checked ? mymap.addLayer(groups[n]) : mymap.removeLayer(groups[n]);
load();
