const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data/tariff_new.json', 'utf8'));

class TollGraph {
    constructor() {
        this.adj = new Map();
        this.gates = new Set();
    }

    addGate(name) {
        this.gates.add(name);
        if (!this.adj.has(name)) this.adj.set(name, []);
    }

    addEdge(from, to) { // We only care about topology here, not rates
        this.addGate(from);
        this.addGate(to);
        this.adj.get(from).push(to);
        this.adj.get(to).push(from);
    }

    addJunction(nodeA, nodeB) {
        if (!this.gates.has(nodeA) || !this.gates.has(nodeB)) {
            // console.warn(`Skipping Junction: ${nodeA} or ${nodeB} not in graph`);
            return;
        }
        this.addEdge(nodeA, nodeB);
    }
}

const graph = new TollGraph();

// 1. Build Base Graph
data.forEach(item => {
    graph.addEdge(item.origin, item.destination);
});

// 2. Apply FIXES (Copy-Paste logical fixes from app.js here to test)
// --- COMPREHENSIVE FIXES ---

// 1. Jakarta Hub (Inner Ring Road / Cawang)
// "Jakarta" (Jagorawi Start) <-> "Cawang"
// "Jakarta IC" (Japek Start) <-> "Cawang"
// "SS Tomang" (Jkt-Tang Start) <-> "Cawang" (Via Inner Ring)
// "Cawang" <-> "Pluit" (CTC) is already in data.
graph.addEdge("Jakarta", "Cawang");
graph.addEdge("Jakarta IC", "Cawang");
graph.addEdge("SS Tomang", "Cawang");

// 2. Trans Jawa Backbone Stitching

// Japek End (Cikampek) <-> Cipali Start (Cikampek Utama)
graph.addJunction("Cikampek", "Cikampek Utama");

// Cipali End (Palimanan) <-> Palikanci Start (Palimanan) -> MATCHES ("Palimanan")

// Palikanci End (Kanci) <-> Kanci-Pejagan Start (Kanci) -> MATCHES ("Kanci")

// Kanci-Pejagan End (Pejagan) <-> Pejagan-Pemalang Start (Pejagan) -> MATCHES ("Pejagan")

// Pejagan-Pemalang End (Pemalang) <-> Pemalang-Batang Start (Pemalang) -> MATCHES ("Pemalang")
// (Note: Removed SS Pemalang check as it doesn't exist in sorted list)

// Pemalang-Batang End (Batang) <-> Batang-Semarang Start (Batang/Pasekaran)
graph.addJunction("Batang", "Batang/Pasekaran");

// Batang-Semarang End (Semarang/Kalikangkung) <-> Semarang ABC (Semarang)
graph.addJunction("Semarang/Kalikangkung", "Semarang");

// Semarang ABC (Banyumanik) <-> Semarang-Solo Start (Banyumanik) -> MATCHES ("Banyumanik")
// BUT we need to link Semarang Hub to Banyumanik if not already linked.
// Data says: Semarang ABC: origin "Semarang", dest "Semarang". (Circular?)
// Let's assume we need to link "Semarang" (ABC) to "Banyumanik".
graph.addEdge("Semarang", "Banyumanik");
// also "Semarang" to "Kalikangkung" is done above via junction.

// Semarang-Solo End (Kartasura) <-> Solo-Ngawi Start (Kartasura) -> MATCHES ("Kartasura")

// Solo-Ngawi End (Ngawi (Klitik)) <-> Ngawi-Kertosono Start (Ngawi)
graph.addJunction("Ngawi (Klitik)", "Ngawi");

// Ngawi-Kertosono End (Kertosono) <-> Kertosono-Mojokerto Start (Bandar)
graph.addJunction("Kertosono", "Bandar");
// Also "Kertosono" <-> "Batas Barat" if exists? (Not seen in sorted list, keeping logic if exists)

// Kertosono-Mojokerto End (Mojokerto) <-> Surabaya-Mojokerto Start (Mojokerto) -> MATCHES ("Mojokerto")   
// Note: Surabaya-Mojokerto "Warugunung" -> "Mojokerto".
// Kertosono-Mojokerto "Bandar" -> "Mojokerto".
// So Mojokerto is the link. OK.

// Surabaya-Mojokerto End (Warugunung) <-> Surabaya-Gempol Start (Waru)
graph.addJunction("Warugunung", "Waru");
// "SS Waru" (Juanda) <-> "Waru"
graph.addJunction("Waru", "SS Waru");

// Surabaya-Gempol (Kejapanan) <-> Gempol-Pasuruan (Gempol)
// "Kejapanan" -> "Gempol".
// "Gempol" is the node.
// Variant names: "Gempol IC", "Gempol JC".
const gempolNodes = ["Gempol", "Gempol IC", "Gempol JC"];
for (let i = 0; i < gempolNodes.length; i++) {
    for (let j = i + 1; j < gempolNodes.length; j++) {
        if (graph.gates.has(gempolNodes[i]) && graph.gates.has(gempolNodes[j])) { // Use gates.has for check
            graph.addJunction(gempolNodes[i], gempolNodes[j]);
        }
    }
}

// Gempol-Pasuruan End (Grati) <-> Pasuruan-Probolinggo Start (Grati) -> MATCHES ("Grati")

// Pandaan
if (graph.gates.has("Pandaan") && graph.gates.has("Pandaan IC")) {
    graph.addJunction("Pandaan", "Pandaan IC");
}
// --- PHASE 2 & 3 ADDITIONAL FIXES (Reducing 42 Islands to 20) ---

// Island 2: Airport <-> Pluit
graph.addEdge("Prof.Dr.Ir.Soedijatmo", "Pluit");

// Island 4 & 5: JORR / ATP / Serpong
graph.addJunction("Rorotan/Cilincing", "Rorotan");
graph.addJunction("Ulujami", "Pondok Pinang");
graph.addJunction("Pondok Aren", "Ulujami");
graph.addJunction("Serpong", "Junction Serpong");

// Link JORR to Main Hub (Taman Mini <-> Cawang/Jagorawi)
graph.addEdge("Taman Mini", "Cawang");

// Island 18: Merak Link
graph.addJunction("SS Tomang", "Tomang IC");

// Island 19: Cipali Link (Cikatama = Cikampek Utama)
graph.addJunction("Cikampek Utama", "Cikatama");

// Island 20: Porong - Gempol Link
graph.addJunction("Porong", "Kejapanan");

// Island 12: Cibitung Link to Japek
graph.addJunction("Jakarta IC", "Cibitung");

// Island 9: Cibitung - Telaga Asih
graph.addJunction("Jc Cibitung", "Cibitung");

// Island 21, 23, 28: Cipularang / Padaleunyi
graph.addJunction("Cikampek", "SS Dawuan");
graph.addJunction("Sadang", "SS Padalarang");
graph.addJunction("Padalarang", "Cileunyi");

// Island 3: Sentul (BORR) -> Jagorawi (Jakarta/Ciawi)
graph.addEdge("Jakarta", "Sentul Selatan");

// Island 4: Cijago -> Jagorawi
graph.addEdge("Cimanggis", "Cisalak");

// Island 7: Cimanggis-Cibitung -> Jagorawi
graph.addJunction("Jatikarya", "Cimanggis");

// Island 5: Desari -> Hub
graph.addEdge("Antasari", "Cawang");

// Island 6: Becakayu -> Hub
graph.addEdge("Casablanca", "Cawang");

// Island 10: 6 Ruas -> Hub
graph.addEdge("Kelapa Gading", "Cawang");

// Island 8: Jkt-Tangerang / Airport
graph.addJunction("JC Benda", "Prof.Dr.Ir.Soedijatmo");

// Trans Sumatera Stitches
// Kramasan (Kayu Agung - Palembang) <-> Palembang
graph.addJunction("Kramasan", "Palembang");

// --------------------------------

// 3. Check Connectivity (Island Counting)
function checkConnectivity() {
    const visited = new Set();
    const islands = [];
    graph.gates.forEach(startNode => {
        if (visited.has(startNode)) return;
        const island = [];
        const q = [startNode];
        visited.add(startNode);
        while (q.length > 0) {
            const node = q.shift();
            island.push(node);
            const neighbors = graph.adj.get(node) || [];
            neighbors.forEach(neighborName => {
                if (!visited.has(neighborName)) {
                    visited.add(neighborName);
                    q.push(neighborName);
                }
            });
        }
        islands.push(island);
    });

    console.log(`\nFound ${islands.length} independent islands.`);
    islands.forEach((isl, i) => {
        console.log(`Island ${i + 1} (${isl.length} nodes): ${isl.join(' | ')}`);
    });

    console.log("\n--- ALL GATES (Sorted) ---");
    const allGates = Array.from(graph.gates).sort();
    allGates.forEach(g => console.log(`"${g}"`));
}

checkConnectivity();
