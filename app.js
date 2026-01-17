// Data is loaded from tariffs.js as a global variable: `tollData`

// --- GRAPH & PATHFINDING ---

class TollGraph {
    constructor() {
        this.adj = new Map(); // Adjacency list: Node -> [ {node, rates} ]
        this.gates = new Set();
    }

    addGate(name) {
        this.gates.add(name);
        if (!this.adj.has(name)) this.adj.set(name, []);
    }

    addEdge(from, to, rates) {
        this.addGate(from);
        this.addGate(to);
        this.adj.get(from).push({ node: to, rates: rates });
        // Assuming bidirectional for now, usually true for toll distance-based stuff
        // But some systems are open/flat. 
        // For Trans Jawa (closed system), Cost A->B == Cost B->A.
        this.adj.get(to).push({ node: from, rates: rates });
    }

    // Connect two nodes with 0 cost (Junctions)
    addJunction(nodeA, nodeB) {
        const zeroRates = { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 };
        this.addEdge(nodeA, nodeB, zeroRates);
    }

    getShortestPath(start, end) {
        // Dijkstra's Algorithm primarily minimizing "Gol I" cost
        // We track totals for all classes though.

        const costs = new Map();
        const prev = new Map();
        const pq = new PriorityQueue();

        this.gates.forEach(gate => costs.set(gate, Infinity));
        costs.set(start, 0);
        pq.enqueue(start, 0);

        // We only track Gol I cost for the priority queue to determine "shortest"
        // (Usually cheapest and shortest are synonymous in toll roads).

        while (!pq.isEmpty()) {
            const { element: current } = pq.dequeue();

            if (current === end) break;

            const neighbors = this.adj.get(current) || [];
            for (const neighbor of neighbors) {
                const newCost = costs.get(current) + neighbor.rates['Gol I'];

                if (newCost < costs.get(neighbor.node)) {
                    costs.set(neighbor.node, newCost);
                    prev.set(neighbor.node, { from: current, rates: neighbor.rates });
                    pq.enqueue(neighbor.node, newCost);
                }
            }
        }

        if (costs.get(end) === Infinity) return null; // No path

        // Reconstruct path and sum all costs
        const path = [];
        let curr = end;
        const totalRates = { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 };

        while (curr !== start) {
            const step = prev.get(curr);
            path.unshift(curr);
            // Add rates
            for (let k in totalRates) totalRates[k] += step.rates[k];
            curr = step.from;
        }
        path.unshift(start);

        return { path, totalRates };
    }
}

// Simple PQ implementation
class PriorityQueue {
    constructor() { this.items = []; }
    enqueue(element, priority) {
        const qElement = { element, priority };
        let contain = false;
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].priority > qElement.priority) {
                this.items.splice(i, 0, qElement);
                contain = true;
                break;
            }
        }
        if (!contain) this.items.push(qElement);
    }
    dequeue() { return this.items.shift(); }
    isEmpty() { return this.items.length === 0; }
}

// --- INIT GRAPH ---
const graph = new TollGraph();

function buildGraph() {
    // 1. Add standard edges from data
    Object.keys(tollData).forEach(ruas => {
        tollData[ruas].forEach(route => {
            graph.addEdge(route.asal, route.tujuan, route.rates);
        });
    });

    // 2. Add Implicit Junctions (Manual Stitching of Trans Jawa)
    // We assume if the name is IDENTICAL, it's already the same node in the Set/Map.
    // We only need to bridge gaps where names differ slightly or are logically separate.

    // Check names in data:
    // Japeck: "Cikampek"
    // Cipali: "Cikopo"
    graph.addJunction("Cikampek", "Cikopo");

    // Tang-Merak: "Cikupa"
    // Jkt-Tang: "SS Tomang" -> "Cikupa"
    // Data now has "Cikupa" in both. Automatically connected.

    // Jkt-Tang starts at "SS Tomang".
    // Need link: SS Tomang (Jkt-Tang) <-> Jakarta IC (Japek).
    // Via Inner Ring Road (Simpang Susun Tomang -> Cawang/Jkt IC).
    // Inner Ring Road Cost ~10.500.
    const innerRingRates = { "Gol I": 10500, "Gol II": 15500, "Gol III": 15500, "Gol IV": 17500, "Gol V": 17500 };
    graph.addEdge("SS Tomang", "Jakarta IC", innerRingRates);

    // Cipali: "Palimanan"
    // Palikanci: "Palimanan" -> Same string. Connected.

    // Palikanci: "Kanci"
    // Kanci-Pejagan: "Kanci" -> Same string. Connected.

    // Pejagan: "Pejagan" -> Same.
    // Pemalang: "Pemalang" vs "SS Pemalang"?
    // Pejagan-Pemalang uses "Pemalang".
    // Pemalang-Batang uses "SS Pemalang".
    graph.addJunction("Pemalang", "SS Pemalang");

    // Batang: "SS Batang" vs "Batang/Pasekaran" vs "Pasekaran"?
    // Pemalang-Batang: "SS Batang" and "Pasekaran".
    // Semarang-Batang: "Batang/Pasekaran" and "Pasekaran".
    // Likely "Pasekaran" is the common node.
    // "SS Batang" -> "Pasekaran" link exists in data? 
    // Pemalang-Batang file has: SS Batang <-> Pasekaran cost 5500.
    // So they are connected.
    // But does Pemalang-Batang connect to Semarang-Batang?
    // Pemalang-Batang end at Pasekaran.
    // Semarang-Batang start at Pasekaran.
    // Same string "Pasekaran". Connected.

    // Semarang: "Kalikangkung".
    // Semarang-Solo start at "Banyumanik".
    // Need link Kalikangkung <-> Banyumanik (Semarang ABC).
    // Cost ~5500.
    const smgABCRates = { "Gol I": 5500, "Gol II": 8000, "Gol III": 8000, "Gol IV": 10500, "Gol V": 10500 };
    graph.addEdge("Kalikangkung", "Banyumanik", smgABCRates);

    // Solo: "Kartasura" -> Same.
    // Ngawi: "Klitik" -> Ngawi-Kertosono starts at "Klitik". Connected.

    // Kertosono: "Kertosono" -> "Bandar"?
    // Ngawi-Kertosono ends "Kertosono".
    // Kertosono-Mojokerto starts "Bandar".
    // Are they same? Bandar is the GT for Kertosono.
    // Let's link them.
    graph.addJunction("Kertosono", "Bandar");

    // Mojokerto: "Mojokerto" -> Same.
    // Surabaya-Mojokerto ends "Warugunung".
    // Surabaya-Gempol start "Waru".
    // Warugunung is slightly different from Waru.
    // Need link Warugunung <-> Waru.
    // Usually via Dupak or just Waru. Assuming Warugunung leads to Waru.
    // Let's add junction.
    graph.addJunction("Warugunung", "Waru");

    // Gempol: "Gempol" -> Same.
    // Gempol-Pandaan uses "Gempol IC" and "Gempol JC".
    // Surabaya-Gempol uses "Gempol".
    // Link them all.
    graph.addJunction("Gempol", "Gempol IC");
    graph.addJunction("Gempol", "Gempol JC");
    graph.addJunction("Gempol IC", "Gempol JC");

    // Pandaan: "Pandaan" vs "Pandaan IC"
    graph.addJunction("Pandaan", "Pandaan IC");

    // Kertosono / Bandar / Batas Barat
    // Ngawi-Kertosono ends at "Kertosono". 
    // Kertosono-Mojokerto has "Bandar" and "Batas Barat".
    // Usually Batas Barat connects to the previous section.
    graph.addJunction("Kertosono", "Batas Barat");
    graph.addJunction("Kertosono", "Bandar"); // Keep this as fallback

    // Debug Connectivity
    console.log("Graph Nodes:", graph.gates.size);
    const islands = [];
    const visited = new Set();

    graph.gates.forEach(startNode => {
        if (visited.has(startNode)) return;
        const island = [];
        const q = [startNode];
        visited.add(startNode);

        while (q.length > 0) {
            const node = q.shift();
            island.push(node);
            const neighbors = graph.adj.get(node) || [];
            neighbors.forEach(req => {
                if (!visited.has(req.node)) {
                    visited.add(req.node);
                    q.push(req.node);
                }
            });
        }
        islands.push(island);
    });

    console.log("Connected Components (Islands):", islands);
    if (islands.length > 1) {
        console.warn("Graph is disconnected! Islands found:", islands);
        // Optional: Alert user if graph is broken, helps debugging
        // alert("Warning: Data koneksi terputus. Cek Console untuk detail.");
    }
}


// --- UI LOGIC ---

const originSelect = document.getElementById('gerbang-asal');
const destinationSelect = document.getElementById('gerbang-tujuan');
const resultArea = document.getElementById('result-area');
const emptyState = document.getElementById('empty-state');

// State
let selectedOrigin = '';
let selectedDestination = '';

// Format Currency
const formatIDR = (num) => new Intl.NumberFormat('id-ID').format(num);

function init() {
    buildGraph();
    populateGateOptions();
    addEventListeners();
}

function populateGateOptions() {
    // Get all unique gates from graph, sorted alphabetically
    const gates = Array.from(graph.gates).sort();

    // Reusable function to populate a select element
    const fill = (selectEl) => {
        selectEl.innerHTML = '<option value="" disabled selected>Pilih Gerbang...</option>';
        gates.forEach(gate => {
            const option = document.createElement('option');
            option.value = gate;
            option.textContent = gate;
            selectEl.appendChild(option);
        });
    };

    fill(originSelect);
    fill(destinationSelect);
}

function addEventListeners() {
    originSelect.addEventListener('change', (e) => {
        selectedOrigin = e.target.value;
        // Enable destination if disabled? No, they are always enabled now.
        calculateAndShowRate();
    });

    destinationSelect.addEventListener('change', (e) => {
        selectedDestination = e.target.value;
        calculateAndShowRate();
    });
}

function calculateAndShowRate() {
    if (!selectedOrigin || !selectedDestination) return;
    if (selectedOrigin === selectedDestination) {
        // Same gate
        alert("Gerbang Asal dan Tujuan tidak boleh sama.");
        return;
    }

    const result = graph.getShortestPath(selectedOrigin, selectedDestination);

    if (result) {
        updatePriceUI(result.totalRates);
        showResult();
    } else {
        alert("Rute tidak ditemukan antar gerbang ini. Mungkin data koneksi belum lengkap.");
        hideResult();
    }
}

function updatePriceUI(rates) {
    document.getElementById('price-gol-1').textContent = formatIDR(rates['Gol I']);
    document.getElementById('price-gol-2').textContent = 'Rp ' + formatIDR(rates['Gol II']);
    document.getElementById('price-gol-3').textContent = 'Rp ' + formatIDR(rates['Gol III']);
    document.getElementById('price-gol-4').textContent = 'Rp ' + formatIDR(rates['Gol IV']);
    document.getElementById('price-gol-5').textContent = 'Rp ' + formatIDR(rates['Gol V']);
}

function showResult() {
    resultArea.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function hideResult() {
    resultArea.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

function checkConnectivity() {
    // Re-run island check and show in UI if bad
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
            neighbors.forEach(req => {
                if (!visited.has(req.node)) {
                    visited.add(req.node);
                    q.push(req.node);
                }
            });
        }
        islands.push(island);
    });

    if (islands.length > 1) {
        const errorMsg = `Data terputus menjadi ${islands.length} bagian terpisah. `;
        const detailMsg = islands.map((isl, i) => `Bagian ${i + 1}: ${isl[0]}... (${isl.length} gerbang)`).join('\n');

        const debugDiv = document.createElement('div');
        debugDiv.style.backgroundColor = '#fee2e2';
        debugDiv.style.color = '#991b1b';
        debugDiv.style.padding = '10px';
        debugDiv.style.marginTop = '10px';
        debugDiv.style.borderRadius = '8px';
        debugDiv.style.fontSize = '12px';
        debugDiv.innerText = "⚠️ SYSTEM WARNING: \n" + errorMsg + "\n" + detailMsg;
        document.querySelector('.app-container').appendChild(debugDiv);
    }
}

// Start
init();
checkConnectivity();
