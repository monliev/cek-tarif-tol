// Data is loaded from tariffs.js as a global variable: `tollData`

// --- GLOBAL ERROR HANDLER ---
window.onerror = function (message, source, lineno, colno, error) {
    alert("System Error: " + message + "\nLine: " + lineno);
    return false;
};

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
        try {
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
        } catch (err) {
            console.error(err);
            alert("Error Calculating Path: " + err.message);
            return null;
        }
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
    try {
        if (!window.tollData) {
            throw new Error("Toll Data is missing/empty");
        }
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
        checkIntegrity();
    } catch (err) {
        console.error("Build Graph Error", err);
        alert("Gagal memproses data tarif: " + err.message);
    }
}

function checkIntegrity() {
    // Checkpoints across Trans Jawa
    const checkpoints = [
        "Merak", "Cikupa", "SS Tomang", "Jakarta IC", "Cikampek",
        "Cikopo", "Palimanan", "Kanci", "Pejagan", "Pemalang", "SS Pemalang",
        "Pasekaran", "Kalikangkung", "Banyumanik", "Kartasura", "Klitik",
        "Kertosono", "Bandar", "Mojokerto", "Warugunung", "Waru", "Gempol",
        "Pasuruan", "Probolinggo Timur"
    ];

    console.log("--- INTEGRITY CHECK ---");
    let broken = false;
    let logMsg = "";

    for (let i = 0; i < checkpoints.length - 1; i++) {
        const start = checkpoints[i];
        const end = checkpoints[i + 1];

        // Ensure nodes exist
        if (!graph.adj.has(start)) {
            console.error(`Node Missing: ${start}`);
            logMsg += `❌ Missing Node: ${start}\n`;
            broken = true;
            continue;
        }
        if (!graph.adj.has(end)) {
            console.error(`Node Missing: ${end}`);
            logMsg += `❌ Missing Node: ${end}\n`;
            broken = true;
            continue;
        }

        const result = graph.getShortestPath(start, end);
        if (result) {
            console.log(`✅ Connected: ${start} -> ${end}`);
        } else {
            console.error(`❌ DISCONNECTED: ${start} -> ${end}`);
            logMsg += `❌ PUTUS: ${start} <-> ${end}\n`;
            broken = true;
        }
    }

    if (broken) {
        alert("⚠️ DIAGNOSA KONEKSI TERPUTUS:\n" + logMsg);
    } else {
        // alert("✅ Koneksi Graph Trans Jawa AMAN (Merak s/d Probolinggo)");
        console.log("All checkpoints connected.");
    }
}


// --- UI LOGIC ---

// --- UI LOGIC ---

// New Elements
const originTrigger = document.getElementById('gerbang-asal-trigger');
const destinationTrigger = document.getElementById('gerbang-tujuan-trigger');
const labelAsal = document.getElementById('label-asal');
const labelTujuan = document.getElementById('label-tujuan');

const resultArea = document.getElementById('result-area');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const searchModal = document.getElementById('search-modal');
const modalTitle = document.getElementById('modal-title');
const searchInput = document.getElementById('gate-search-input');
const gateList = document.getElementById('gate-list');

// State
let selectedOrigin = '';
let selectedDestination = '';
let currentMode = ''; // 'origin' or 'destination'

// Format Currency
const formatIDR = (num) => new Intl.NumberFormat('id-ID').format(num);

function init() {
    buildGraph();
    // No longer populating select options directly
}

// --- MODAL & SEARCH LOGIC ---

function openSearchModal(mode) {
    currentMode = mode;
    modalTitle.textContent = mode === 'origin' ? 'Pilih Gerbang Asal' : 'Pilih Gerbang Tujuan';
    searchInput.value = '';
    renderGateList();
    searchModal.classList.remove('hidden');
    searchInput.focus();
}

function closeSearchModal() {
    searchModal.classList.add('hidden');
}

function renderGateList(filterText = '') {
    gateList.innerHTML = '';
    const gates = Array.from(graph.gates).sort();

    const filtered = gates.filter(gate =>
        gate.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach(gate => {
        const div = document.createElement('div');
        div.className = 'gate-item';
        div.textContent = gate;

        // Highlight selected
        if ((currentMode === 'origin' && gate === selectedOrigin) ||
            (currentMode === 'destination' && gate === selectedDestination)) {
            div.classList.add('selected');
        }

        div.onclick = () => selectGate(gate);
        gateList.appendChild(div);
    });
}

function filterGates() {
    renderGateList(searchInput.value);
}

function selectGate(gate) {
    if (currentMode === 'origin') {
        selectedOrigin = gate;
        labelAsal.textContent = gate;
        labelAsal.style.color = 'var(--text-main)';
        labelAsal.style.fontWeight = '600';
    } else {
        selectedDestination = gate;
        labelTujuan.textContent = gate;
        labelTujuan.style.color = 'var(--text-main)';
        labelTujuan.style.fontWeight = '600';
    }

    closeSearchModal();
    calculateAndShowRate();
}

// --- LIVE DATA & ANDROID INTERFACE ---

// URL Raw GitHub untuk data terbaru (Ganti Username/Repo jika perlu)
const DATA_URL = "https://raw.githubusercontent.com/monliev/cek-tarif-tol/main/data/tariffs.js";

async function checkForUpdates() {
    try {
        console.log("Checking for updates...");
        // Tambahkan timestamp agar tidak dicache
        const response = await fetch(DATA_URL + "?t=" + new Date().getTime());
        if (!response.ok) throw new Error("Network response was not ok");

        const text = await response.text();

        // Parsing manual JS file untuk mengambil object JSON
        // Mencari string: const tollData = { ... }
        const regex = /const tollData = (\{[\s\S]*?\});/;
        const match = text.match(regex);

        if (match && match[1]) {
            // Evaluasi string JSON menjadi Object
            // Menggunakan Function constructor lebih aman dari eval() langsung (sedikit)
            // Tapi karena JSON valid, kita coba parse JSON. 
            // Namun tariffs.js mungkin tidak valid JSON 100% (key tidak dipetik).
            // Kita gunakan evaluasi terbatas.
            const newData = new Function("return " + match[1])();

            if (newData && Object.keys(newData).length > 0) {
                console.log("Update found! Applying new tariffs.");
                window.tollData = newData; // Override global data
                buildGraph(); // Rebuild graph with new data
                // Update UI if needed (re-populate options usually not needed unless nodes change)
                populateGateOptionsIfNeeded();
            }
        }
    } catch (error) {
        console.log("Update check failed (Offline or Error):", error);
        console.log("Using local data.");
    }
}

function populateGateOptionsIfNeeded() {
    // Jika node berubah drastis, kita perlu refresh suggestion.
    // Simpelnya: kita biarkan user search, logic search akan baca graph.gates terbaru.
    // Jadi tidak perlu refresh UI eksplisit karena search based on graph.
}

// Interstitial Counter
let calcCount = 0;
const AD_INTERVAL = 3; // Munculkan iklan setiap 3x klik hitung

// Android Bridge Wrapper
function triggerInterstitial() {
    if (window.Android && window.Android.showInterstitial) {
        window.Android.showInterstitial();
    } else {
        console.log("Native Ad Interstitial Not Found (Running in Browser?)");
    }
}

// --- CUSTOM ALERT LOGIC ---
window.alert = function (message) {
    const modal = document.getElementById('alert-modal');
    const body = document.getElementById('alert-message');
    if (modal && body) {
        body.innerText = message;
        modal.classList.remove('hidden');
    } else {
        console.log("Alert Modal Not Found:", message);
    }
};

window.closeAlert = function () {
    document.getElementById('alert-modal').classList.add('hidden');
};

// Override Global Error Handler to use new Alert
window.onerror = function (message, source, lineno, colno, error) {
    // alert("System Error: " + message + "\nLine: " + lineno);
    console.error(message);
    return false;
};

// FIXED Trigger Share with Debug
// FIXED Trigger Share with COMPACT FIT
function triggerShare() {
    console.log("--- BUTTON CLICKED: triggerShare ---");

    if (window.Android && window.Android.shareScreenshot) {
        window.scrollTo(0, 0);

        // 1. Simpan Style Lama
        const oldBodyPad = document.body.style.paddingBottom;
        const oldBodyMinH = document.body.style.minHeight;
        const oldHtmlMinH = document.documentElement.style.minHeight;

        // 2. SET COMPACT MODE (Penyusutan)
        // Paksa halaman menyusut sesuai konten, abaikan tinggi layar HP
        document.body.style.paddingBottom = "0px";
        document.body.style.minHeight = "auto";
        document.documentElement.style.minHeight = "auto";
        document.body.style.height = "auto";
        document.documentElement.style.height = "auto";

        // Delay rendering
        setTimeout(() => {
            const container = document.querySelector('.app-container');
            var realHeight = container.offsetHeight;
            realHeight += 10; // Buffer

            console.log("Sending Height to Android: " + realHeight);

            // Hapus Alert/Toast Debug agar user tidak bingung
            // alert("Debug Height: " + realHeight);

            window.Android.shareScreenshot(realHeight);

            // 3. Restore Style Lama
            setTimeout(() => {
                document.body.style.paddingBottom = oldBodyPad;
                document.body.style.minHeight = oldBodyMinH;
                document.documentElement.style.minHeight = oldHtmlMinH;
            }, 500);

        }, 800);
    } else {
        alert("Fitur Share hanya tersedia di Aplikasi.");
    }
}

// Updated Calculate function with Ad Trigger
function calculateAndShowRate() {
    if (!selectedOrigin || !selectedDestination) return;
    if (selectedOrigin === selectedDestination) {
        alert("Gerbang Asal dan Tujuan tidak boleh sama.");
        return;
    }

    const result = graph.getShortestPath(selectedOrigin, selectedDestination);

    if (result) {
        updatePriceUI(result.totalRates);
        showResult();

        // Logic Iklan Interstitial
        calcCount++;
        if (calcCount % AD_INTERVAL === 0) {
            triggerInterstitial();
        }

    } else {
        alert("Rute tidak ditemukan antar gerbang ini. Mungkin data koneksi belum lengkap.");
        hideResult();
    }
}

// ... (Existing Functions) ...

// ... (Existing Functions) ...

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

// --- MISSING UI FUNCTIONS RESTORED ---

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

// Start
init();
// checkForUpdates(); // Risky regex, disabling for stability temporarily
checkConnectivity();