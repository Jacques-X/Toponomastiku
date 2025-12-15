#!/bin/bash
OUTPUT="project_context.txt"

echo "--- START OF PROJECT CONTEXT ---" > $OUTPUT
echo "PROJECT: Toponomastiku Wiki (Malta Hybrid GIS)" >> $OUTPUT
echo "DATE: $(date)" >> $OUTPUT
echo "TECH STACK: Node.js, Express, SQLite3, Leaflet.js, Axios, Dotenv" >> $OUTPUT
echo "CAPABILITIES: Local Tile Caching (Esri), Real-time WMS Proxy (Malta PA), OSM Boundary Fetching, Wiki CRUD" >> $OUTPUT

echo -e "\n--- DIRECTORY STRUCTURE ---" >> $OUTPUT
ls -R | grep ":$" | sed -e 's/:$//' -e 's/[^-][^\/]*\//--/g' -e 's/^/   /' >> $OUTPUT

# Function to safely append files with headers
add_to_stream() {
    if [ -f "$1" ]; then
        echo -e "\n--- FILE: $1 ---" >> $OUTPUT
        cat "$1" >> $OUTPUT
        echo -e "\n--- END OF FILE: $1 ---" >> $OUTPUT
    else
        echo -e "\n--- FILE: $1 (Not Found) ---" >> $OUTPUT
    fi
}

# Core Logic
add_to_stream "package.json"
add_to_stream ".env"
add_to_stream "server.js"
add_to_stream "turbo-seed.js"
add_to_stream "fix-tiles.js"

# Frontend
add_to_stream "public/index.html"
add_to_stream "public/style.css"
add_to_stream "public/script.js"

# Optional: Sample of DB Schema (not the whole binary)
echo -e "\n--- DATABASE SCHEMA ---" >> $OUTPUT
sqlite3 map_data.db ".schema" >> $OUTPUT 2>/dev/null || echo "Database file not found yet." >> $OUTPUT

echo -e "\n--- END OF PROJECT CONTEXT ---" >> $OUTPUT
echo "✅ Everything packaged into: $OUTPUT"
