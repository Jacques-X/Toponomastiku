
// ---------- LANGUAGE TOGGLE ----------
const languageSelect = document.getElementById('language-select');
let currentLang = 'mt'; // default Maltese

languageSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateLabelsLanguage();
});

function updateLabelsLanguage() {
    document.querySelectorAll('.layer-title').forEach(el => {
        if (el.textContent.includes('Local Councils')) {
            el.textContent = (currentLang === 'mt') ? 'Kunsilli Lokali' : 'Local Councils';
        } else if (el.textContent.includes('Zones')) {
            el.textContent = (currentLang === 'mt') ? 'Żoni u Raħal' : 'Zones & Hamlets';
        } else if (el.textContent.includes('Points of Interest')) {
            el.textContent = (currentLang === 'mt') ? 'Punti ta\' Interess' : 'Points of Interest';
        }
    });

    const searchInput = document.getElementById('map-search');
    searchInput.placeholder = (currentLang === 'mt') ? 'Fittex lokalità...' : 'Find locality...';
}
