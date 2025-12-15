var mymap = L.map('mapid', { zoomControl: false, maxZoom: 22, minZoom: 12 }).setView([35.91, 14.42], 13);
L.control.zoom({ position: 'bottomright' }).addTo(mymap);

const groups = {
    "Local Council": new L.FeatureGroup().addTo(mymap),
    "Boundaries": new L.FeatureGroup().addTo(mymap),
    "Zone Names": new L.FeatureGroup().addTo(mymap),
    "Place Names": new L.FeatureGroup().addTo(mymap)
};

// --- LAYER DEFINITIONS ---
const esriLocal = L.tileLayer('/tiles?source=esri&z={z}&x={x}&y={y}', {
    maxNativeZoom: 19, maxZoom: 22
}).addTo(mymap);

const getPALayer = (year) => {
    return L.tileLayer.wms('/tiles', {
        source: 'pa',
        year: year,
        format: 'image/png',
        transparent: true,
        maxZoom: 20,
        // Leaflet handles BBOX, width, and height automatically for WMS
    });
};

let currentBase = esriLocal;

window.changeBaseLayer = (val) => {
    mymap.removeLayer(currentBase);
    currentBase = (val === 'current') ? esriLocal : getPALayer(val);
    mymap.addLayer(currentBase);
};

// ... (Rest of Label/OSM loading logic)
async function load() {
    const res = await fetch('/api/placenames');
    const data = await res.json();
    data.forEach(d => {
        const icon = L.divIcon({ 
            className: 'custom-label', 
            html: `<span>${d.name}</span>`, 
            iconSize: [0,0] 
        });
        L.marker([d.lat, d.lng], {icon, interactive: false}).addTo(groups[d.category] || groups["Place Names"]);
    });
}
load();
