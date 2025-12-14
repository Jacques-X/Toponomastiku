var mymap = L.map('mapid', { zoomControl: false, maxZoom: 22 }).setView([35.83, 14.47], 15);
L.control.zoom({ position: 'bottomright' }).addTo(mymap);

const renderedIds = new Set();
const groups = {
    "Local Council": new L.FeatureGroup().addTo(mymap),
    "Zone Names": new L.FeatureGroup().addTo(mymap),
    "Place Names": new L.FeatureGroup().addTo(mymap),
    "Boundaries": new L.FeatureGroup().addTo(mymap)
};

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 19
}).addTo(mymap);

function renderLabel(lat, lng, text, category, id) {
    if (renderedIds.has(id)) return;
    const sizes = { "Local Council": "15px", "Zone Names": "13px", "Place Names": "11px" };
    const icon = L.divIcon({ 
        className: 'custom-placename-label', 
        html: `<span style="font-size:${sizes[category] || '11px'}">${text}</span>`,
        iconSize: [0, 0]
    });
    L.marker([lat, lng], {icon, interactive: false}).addTo(groups[category] || groups["Place Names"]);
    renderedIds.add(id);
}

async function load() {
    const res = await fetch('/api/placenames');
    const data = await res.json();
    data.forEach(d => renderLabel(d.lat, d.lng, d.name, d.category, d.id));
    fetchOSM();
}

async function fetchOSM() {
    const bbox = "35.78,14.15,36.10,14.65";
    const q = `[out:json][timeout:30];(rel["boundary"="administrative"]["admin_level"="8"](${bbox});node["place"~"city|town|village|suburb|neighbourhood|locality|hamlet"](${bbox}););out body;>;out skel qt;`;
    try {
        const res = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
        const data = await res.json();
        const nodes = {};
        data.elements.filter(e => e.type === 'node').forEach(n => {
            nodes[n.id] = [n.lat, n.lon];
            if (n.tags && n.tags.name) {
                let cat = "Place Names";
                if (["city", "town", "village"].includes(n.tags.place)) cat = "Local Council";
                else if (["suburb", "neighbourhood", "locality"].includes(n.tags.place)) cat = "Zone Names";
                renderLabel(n.lat, n.lon, n.tags.name, cat, n.id);
            }
        });
        const ways = {};
        data.elements.filter(e => e.type === 'way').forEach(w => {
            ways[w.id] = w.nodes.map(nid => nodes[nid]).filter(n => n !== undefined);
        });
        data.elements.filter(e => e.type === 'relation').forEach(rel => {
            rel.members.filter(m => m.type === 'way').forEach(m => {
                if (ways[m.ref]) L.polyline(ways[m.ref], {color:'#fff', weight:1.5, opacity:0.6, dashArray:'2,6'}).addTo(groups["Boundaries"]);
            });
        });
    } catch (e) {}
}

const draw = new L.Control.Draw({ position: 'topright', draw: { marker: true, polyline:false, polygon:false, circle:false, rectangle:false, circlemarker:false } });
mymap.addControl(draw);

mymap.on(L.Draw.Event.CREATED, (e) => {
    const name = prompt("Placename:");
    const cat = prompt("Category (Local Council, Zone Names, Place Names):", "Zone Names");
    if (name) {
        fetch('/api/placenames', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, category: cat, lat: e.layer.getLatLng().lat, lng: e.layer.getLatLng().lng })
        }).then(() => location.reload());
    }
});

window.toggleLayer = (n, el) => el.checked ? mymap.addLayer(groups[n]) : mymap.removeLayer(groups[n]);
load();
