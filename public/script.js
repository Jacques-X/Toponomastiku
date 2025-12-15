document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. INITIALIZE MAP ---
    const mymap = L.map('mapid', { zoomControl: false, minZoom: 11, maxZoom: 22 }).setView([35.91, 14.45], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(mymap);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxNativeZoom: 19, maxZoom: 22
    }).addTo(mymap);

    // --- 2. LAYERS & STATE ---
    const groups = {
        "Local Council": L.featureGroup().addTo(mymap),
        "Zone Names": L.featureGroup().addTo(mymap),
        "Place Names": L.featureGroup().addTo(mymap)
    };

    const markersById = {}; 
    const localPlaceNames = new Set(); 
    // NEW: Set to store IDs of deleted OSM items
    const hiddenIds = new Set();

    let isAddMode = false;
    let currentUser = null; 
    let currentInspectData = null; 
    let currentMarker = null;

    // --- 3. AUTH SYSTEM ---
    async function checkAuth() {
        try {
            const res = await fetch('/auth/me');
            const data = await res.json();
            const authDiv = document.getElementById('auth-status-area');
            const addBtn = document.getElementById('fab-add');
            
            if (data.loggedIn) {
                currentUser = data.username;
                authDiv.innerHTML = `<span class="user-badge">Hi, ${currentUser}</span><button class="btn-cancel" onclick="logout()" style="margin-top:5px; padding:6px; font-size:0.75rem;">Logout</button>`;
                addBtn.classList.remove('hidden');
            } else {
                currentUser = null;
                authDiv.innerHTML = `<button class="btn-primary" onclick="openAuthModal()" style="font-size:0.8rem;">Login / Register</button>`;
                addBtn.classList.add('hidden');
            }
        } catch(e) { console.error("Auth Error", e); }
    }

    window.openAuthModal = () => document.getElementById('auth-modal').classList.remove('hidden');
    window.closeAuthModal = () => document.getElementById('auth-modal').classList.add('hidden');
    
    let isRegistering = false;
    window.toggleAuthMode = () => {
        isRegistering = !isRegistering;
        const btn = document.getElementById('btn-auth-submit');
        const txt = document.getElementById('auth-switch-text');
        const title = document.getElementById('auth-title');
        if(isRegistering) { title.innerText="Register"; btn.innerText="Create Account"; txt.innerText="Have an account? Login"; } 
        else { title.innerText="Login"; btn.innerText="Login"; txt.innerText="No account? Register"; }
    };

    window.handleAuth = async (e) => {
        e.preventDefault();
        const u = document.getElementById('auth-user').value;
        const p = document.getElementById('auth-pass').value;
        const endpoint = isRegistering ? '/auth/register' : '/auth/login';
        try {
            const res = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username: u, password: p }) });
            const data = await res.json();
            if(data.success) location.reload();
            else alert(data.error || "Authentication failed");
        } catch(e) { alert("Connection error"); }
    };

    window.logout = async () => { await fetch('/auth/logout', { method: 'POST' }); location.reload(); };

    // --- 4. RENDER LOGIC ---
    function renderLabel(lat, lng, nameMt, nameEn, category, id) {
        if (!lat || !lng || markersById[id]) return;
        if(category !== 'Local Council') localPlaceNames.add(nameMt.toLowerCase());

        let sizeClass = 'chip-sm'; 
        if (category === 'Local Council') sizeClass = 'chip-xl';
        if (category === 'Zone Names') sizeClass = 'chip-md';

        const html = `
            <span class="label-chip ${sizeClass}">
                <span class="text-mt">${nameMt}</span>
                <span class="text-en">${nameEn || nameMt}</span>
            </span>`;

        const icon = L.divIcon({ className: 'custom-label', html: html });
        const marker = L.marker([lat, lng], { icon, interactive: true });

        markersById[id] = marker;

        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            if(currentMarker && currentMarker !== marker) cancelEditMode(); 
            currentMarker = marker; 
            openInspector({ id, nameMt, nameEn, category, lat, lng });
        });

        if (groups[category]) marker.addTo(groups[category]);
    }

    // --- 5. DATA LOADING (UPDATED) ---
    async function loadData() {
        // 1. Fetch Blacklist (Hidden Items) first
        try {
            const hRes = await fetch('/api/hidden');
            const hData = await hRes.json();
            hData.forEach(id => hiddenIds.add(id)); // Populate the Set
        } catch(e) { console.error("Could not load hidden places", e); }

        // 2. Fetch Local DB
        try {
            const res = await fetch('/api/placenames');
            const data = await res.json();
            data.forEach(p => renderLabel(p.lat, p.lng, p.name, p.name, p.category, p.id));
        } catch (e) { console.error("Local DB Error", e); }

        // 3. Fetch OSM Data
        const bbox = "35.78,14.15,36.10,14.65";
        const q = `[out:json][timeout:25];(node["place"](${bbox}););out body;`;
        try {
            const r = await fetch("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(q));
            const d = await r.json();
            d.elements.forEach(el => {
                const osmId = 'osm-' + el.id;

                // CHECK: Is this ID in our blacklist?
                if (hiddenIds.has(osmId)) return; // Skip if user deleted it

                if (el.tags && el.tags.name && !localPlaceNames.has(el.tags.name.toLowerCase())) { 
                    let cat = "Place Names";
                    if (["city", "town", "village"].includes(el.tags.place)) cat = "Local Council";
                    else if (["suburb", "locality"].includes(el.tags.place)) cat = "Zone Names";
                    
                    renderLabel(el.lat, el.lon, el.tags.name, el.tags['name:en'], cat, osmId);
                }
            });
        } catch (e) {}
    }

    // --- 6. INSPECTOR & EDIT LOGIC ---
    window.openInspector = async (data) => {
        currentInspectData = data;
        const panel = document.getElementById('inspector');
        
        document.getElementById('view-mode').classList.remove('hidden');
        document.getElementById('edit-mode').classList.add('hidden');
        
        document.getElementById('insp-title').innerText = data.nameMt;
        document.getElementById('insp-cat').innerText = data.category;
        document.getElementById('insp-coords').innerText = `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`;
        
        panel.classList.remove('hidden');

        const editBtn = document.getElementById('btn-edit-trigger');
        const loginWarn = document.getElementById('login-warning');
        if (currentUser) { editBtn.classList.remove('hidden'); loginWarn.classList.add('hidden'); }
        else { editBtn.classList.add('hidden'); loginWarn.classList.remove('hidden'); }

        const list = document.getElementById('insp-history-list');
        list.innerHTML = '<li>Loading...</li>';
        
        // We can show history for OSM items too now if they have been edited/deleted in our system
        try {
            const res = await fetch(`/api/history/${data.id}`);
            const hData = await res.json();
            list.innerHTML = '';
            if(!hData.length) {
                if(data.id.startsWith('osm-')) list.innerHTML = `<li>Source: <strong>OpenStreetMap</strong></li>`;
                else list.innerHTML = '<li>No history found.</li>';
            }
            hData.forEach(h => list.innerHTML += `<li><span class="date">${h.action}</span> by <strong>${h.username||'Unknown'}</strong></li>`);
        } catch(e) { list.innerHTML = '<li>History unavailable.</li>'; }
    };

    window.closeInspector = () => {
        if(!document.getElementById('edit-mode').classList.contains('hidden')) cancelEditMode();
        document.getElementById('inspector').classList.add('hidden');
        currentMarker = null;
    };

    window.enableEditMode = () => {
        document.getElementById('view-mode').classList.add('hidden');
        document.getElementById('edit-mode').classList.remove('hidden');
        
        document.getElementById('edit-id').value = currentInspectData.id;
        document.getElementById('edit-name').value = currentInspectData.nameMt;
        document.getElementById('edit-lat').value = currentInspectData.lat;
        document.getElementById('edit-lng').value = currentInspectData.lng;
        document.getElementById('edit-category').value = currentInspectData.category;
        
        const isLocal = currentInspectData.id.startsWith('wiki-');
        document.getElementById('edit-source').value = isLocal ? 'local' : 'osm';

        // ALWAYS show delete button now
        document.getElementById('delete-section').classList.remove('hidden');

        if(currentMarker) {
            currentMarker.dragging.enable();
            currentMarker.setZIndexOffset(1000);
            const el = currentMarker.getElement();
            if(el) el.classList.add('marker-editing');

            currentMarker.on('dragend', (e) => {
                const { lat, lng } = e.target.getLatLng();
                document.getElementById('edit-lat').value = lat.toFixed(6);
                document.getElementById('edit-lng').value = lng.toFixed(6);
            });
        }
    };

    window.cancelEditMode = () => {
        document.getElementById('view-mode').classList.remove('hidden');
        document.getElementById('edit-mode').classList.add('hidden');

        if(currentMarker) {
            currentMarker.dragging.disable();
            currentMarker.setZIndexOffset(0);
            currentMarker.setLatLng([currentInspectData.lat, currentInspectData.lng]);
            const el = currentMarker.getElement();
            if(el) el.classList.remove('marker-editing');
        }
    };

    window.saveInspectorChanges = async (e) => {
        e.preventDefault();
        
        const oldId = document.getElementById('edit-id').value;
        const source = document.getElementById('edit-source').value;
        const method = (source === 'local') ? 'PUT' : 'POST';
        const url = (source === 'local') ? `/api/placenames/${oldId}` : '/api/placenames';
        
        const name = document.getElementById('edit-name').value;
        const category = document.getElementById('edit-category').value;
        const lat = parseFloat(document.getElementById('edit-lat').value);
        const lng = parseFloat(document.getElementById('edit-lng').value);

        try {
            const res = await fetch(url, { 
                method, 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({ name, category, lat, lng }) 
            });

            if(res.ok) {
                const responseData = await res.json();
                const finalId = responseData.id || oldId;

                // SPECIAL HANDLING:
                // If we edited an OSM node, the server created a new Local Node.
                // But we must also "Hide" the old OSM node so it doesn't show up as a duplicate.
                // We do this by calling DELETE on the old OSM ID silently.
                if(source === 'osm') {
                    await fetch(`/api/placenames/${oldId}`, { method: 'DELETE' }); // This adds it to hidden_places
                }

                if(markersById[oldId]) {
                    markersById[oldId].remove(); 
                    delete markersById[oldId];  
                }

                renderLabel(lat, lng, name, name, category, finalId);

                if (markersById[finalId]) {
                    currentMarker = markersById[finalId];
                    currentInspectData = { id: finalId, nameMt: name, nameEn: name, category, lat, lng };
                    openInspector(currentInspectData);
                }

                document.getElementById('edit-mode').classList.add('hidden');
                document.getElementById('view-mode').classList.remove('hidden');

            } else {
                alert("Error saving");
            }
        } catch(e) { console.error(e); alert("Save failed"); }
    };

    // --- 7. UNIVERSAL DELETE FUNCTION ---
    window.deleteCurrentPlace = async () => {
        const id = document.getElementById('edit-id').value;
        if (!confirm("Are you sure you want to delete this place?")) return;

        try {
            const res = await fetch(`/api/placenames/${id}`, { method: 'DELETE' });
            if(res.ok) {
                // Remove from map instantly
                if(markersById[id]) {
                    markersById[id].remove();
                    delete markersById[id];
                }
                // Add to our local blacklist so it doesn't reappear on reload (just in case)
                hiddenIds.add(id);
                closeInspector();
            } else {
                alert("Could not delete. Check your permissions.");
            }
        } catch(e) { alert("Connection error."); }
    };

    window.handleFormSubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-name').value;
        const category = document.getElementById('new-category').value;
        const lat = parseFloat(document.getElementById('new-lat').value);
        const lng = parseFloat(document.getElementById('new-lng').value);

        try {
            const res = await fetch('/api/placenames', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ name, category, lat, lng })
            });
            
            if(res.ok) {
                const newPlace = await res.json();
                renderLabel(newPlace.lat, newPlace.lng, newPlace.name, newPlace.name, newPlace.category, newPlace.id);
                closeModal();
            }
        } catch(e) { alert("Error"); }
    };

    // --- UTILS ---
    window.toggleAddMode = () => {
        isAddMode = !isAddMode;
        const btn = document.getElementById('fab-add');
        const mapEl = document.getElementById('mapid');
        if (isAddMode) { btn.classList.add('active'); mapEl.style.cursor = 'crosshair'; } 
        else { btn.classList.remove('active'); mapEl.style.cursor = 'default'; }
    };

    mymap.on('click', (e) => {
        if (isAddMode) {
            document.getElementById('new-lat').value = e.latlng.lat;
            document.getElementById('new-lng').value = e.latlng.lng;
            document.getElementById('add-modal').classList.remove('hidden');
            isAddMode = false;
            toggleAddMode();
            return;
        }
        closeInspector();
    });

    window.closeModal = () => document.getElementById('add-modal').classList.add('hidden');
    window.toggleLayer = (n, el) => el.checked ? mymap.addLayer(groups[n]) : mymap.removeLayer(groups[n]);
    window.toggleLanguage = (lang) => document.body.className = lang === 'en' ? 'lang-en' : 'lang-mt';

    checkAuth();
    loadData();
});