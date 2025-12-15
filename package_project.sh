#!/bin/bash
OUTPUT="project_context.txt"

echo "--- START OF PROJECT CONTEXT ---" > $OUTPUT
echo "PROJECT NAME: Toponomastiku Wiki (Malta Offline Map)" >> $OUTPUT
echo "DATE: $(date)" >> $OUTPUT
echo "ARCHITECTURE: Node.js, Express, SQLite3, Leaflet.js" >> $OUTPUT
echo "FEATURES: Local Tile Cache (Esri), OSM Boundary Fetcher, Wiki Editing" >> $OUTPUT
echo -e "\n--- FILE STRUCTURE ---" >> $OUTPUT
ls -R | grep ":$" | sed -e 's/:$//' -e 's/[^-][^\/]*\//--/g' -e 's/^/   /' >> $OUTPUT

# Function to append file content with delimiters
append_file() {
    if [ -f "$1" ]; then
        echo -e "\n--- FILE: $1 ---" >> $OUTPUT
        cat "$1" >> $OUTPUT
        echo -e "\n--- END OF FILE: $1 ---" >> $OUTPUT
    fi
}

append_file "package.json"
append_file "server.js"
append_file "seed-tiles.js"
append_file "turbo-seed.js"
append_file "public/index.html"
append_file "public/style.css"
append_file "public/script.js"

echo -e "\n--- END OF PROJECT CONTEXT ---" >> $OUTPUT
echo "✅ Project packaged into $OUTPUT"
