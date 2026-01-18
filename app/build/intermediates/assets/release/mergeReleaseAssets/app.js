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
            // SPECIAL CASE: Start == End (Self-Loop for Open System)
            if (start === end) {
                const neighbors = this.adj.get(start) || [];
                const selfEdge = neighbors.find(n => n.node === start);
                if (selfEdge) {
                    return {
                        path: [start, start],
                        totalRates: { ...selfEdge.rates } // Clone to avoid ref issues
                    };
                }
            }

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

// --- INIT & DATA LOADING ---
const graph = new TollGraph();

// const DATA_URL = "./data/tariff_new.json"; // Disabled for Android Compatibility

function init() {
    try {
        // Load data directly from global variable (loaded via script tag)
        if (window.tollData) {
            buildGraph(window.tollData);
            checkConnectivity();
        } else {
            throw new Error("window.tollData is missing. Script load failed?");
        }
    } catch (err) {
        console.error("Initialization Error:", err);
        alert("Gagal memuat aplikasi: " + err.message);
    }
}

// Deprecated: fetch causes errors on Android WebView file:// protocol
/*
async function loadTollData() {
    console.log("Loading tariff data...");
    const response = await fetch(DATA_URL + "?t=" + new Date().getTime()); // Prevent cache
    if (!response.ok) throw new Error("Failed to load tariff data");
    return await response.json();
}
*/

function buildGraph(data) {
    try {
        if (!data || !Array.isArray(data)) {
            throw new Error("Invalid format: Data must be an array");
        }

        // 1. Build Base Graph (with validation)
        data.forEach(item => {
            if (!item.origin || item.origin.trim() === "" || !item.destination || item.destination.trim() === "") {
                return; // Skip invalid data
            }
            // Map keys from JSON (gol1) to Graph (Gol I)
            const rates = {
                "Gol I": item.rates.gol1,
                "Gol II": item.rates.gol2,
                "Gol III": item.rates.gol3,
                "Gol IV": item.rates.gol4,
                "Gol V": item.rates.gol5
            };
            graph.addEdge(item.origin, item.destination, rates);
        });

        // 2. Add Implicit Junctions (Manual Stitching of Trans Jawa)
        // We assume if the name is IDENTICAL, it's already the same node in the Set/Map.
        // We only need to bridge gaps where names differ slightly or are logically separate.

        // --- COMPREHENSIVE FIXES FOR DATA CONNECTIVITY ---

        // 1. Jakarta Hub (Inner Ring Road / Cawang)
        // "Jakarta" (Jagorawi Start) <-> "Cawang"
        // "Jakarta IC" (Japek Start) <-> "Cawang"
        // "SS Tomang" (Jkt-Tang Start) <-> "Cawang" (Via Inner Ring)
        graph.addEdge("Jakarta", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 }); // Gateway
        graph.addEdge("Jakarta IC", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 }); // Gateway
        const innerRingRates = { "Gol I": 10500, "Gol II": 15500, "Gol III": 15500, "Gol IV": 17500, "Gol V": 17500 };
        graph.addEdge("SS Tomang", "Cawang", innerRingRates);

        // 2. Trans Jawa Backbone Stitching

        // Japek End (Cikampek) <-> Cipali Start (Cikampek Utama)
        graph.addJunction("Cikampek", "Cikampek Utama");

        // Pejagan: "Pejagan" -> SAME.
        // Pemalang: "Pemalang" -> SAME.

        // Pemalang-Batang End (Batang) <-> Batang-Semarang Start (Batang/Pasekaran)
        graph.addJunction("Batang", "Batang/Pasekaran");

        // Batang-Semarang End (Semarang/Kalikangkung) <-> Semarang ABC (Semarang)
        graph.addJunction("Semarang/Kalikangkung", "Semarang");

        // Semarang-Solo Start (Banyumanik) <-> Semarang Hub (Semarang)
        const smgABCRates = { "Gol I": 5500, "Gol II": 8000, "Gol III": 8000, "Gol IV": 10500, "Gol V": 10500 };
        graph.addEdge("Semarang", "Banyumanik", smgABCRates);

        // Solo-Ngawi End (Ngawi (Klitik)) <-> Ngawi-Kertosono Start (Ngawi)
        graph.addJunction("Ngawi (Klitik)", "Ngawi");

        // Ngawi-Kertosono End (Kertosono) <-> Kertosono-Mojokerto Start (Bandar)
        graph.addJunction("Kertosono", "Bandar");

        // Kertosono-Mojokerto End (Mojokerto) <-> Surabaya-Mojokerto Start (Mojokerto) -> MATCHES ("Mojokerto")

        // Surabaya-Mojokerto End (Warugunung) <-> Surabaya-Gempol Start (Waru)
        graph.addJunction("Warugunung", "Waru");

        // "SS Waru" (Juanda) <-> "Waru"
        graph.addJunction("Waru", "SS Waru");

        // Gempol Complex
        const gempolNodes = ["Gempol", "Gempol IC", "Gempol JC"];
        for (let i = 0; i < gempolNodes.length; i++) {
            for (let j = i + 1; j < gempolNodes.length; j++) {
                if (graph.adj.has(gempolNodes[i]) && graph.adj.has(gempolNodes[j])) {
                    graph.addJunction(gempolNodes[i], gempolNodes[j]);
                }
            }
        }

        // Pandaan
        if (graph.adj.has("Pandaan") && graph.adj.has("Pandaan IC")) {
            graph.addJunction("Pandaan", "Pandaan IC");
        }

        // Kertosono / Bandar / Batas Barat
        if (graph.adj.has("Kertosono") && graph.adj.has("Batas Barat")) {
            graph.addJunction("Kertosono", "Batas Barat");
        }

        // --- PHASE 2 FIXES (JORR, Airport, etc) ---

        // Island 2: Airport <-> Pluit
        graph.addEdge("Prof.Dr.Ir.Soedijatmo", "Pluit", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 4 & 5: JORR / ATP / Serpong
        graph.addJunction("Rorotan/Cilincing", "Rorotan");
        graph.addJunction("Ulujami", "Pondok Pinang");
        graph.addJunction("Pondok Aren", "Ulujami");
        graph.addJunction("Serpong", "Junction Serpong");

        // Link JORR to Main Hub (Taman Mini <-> Cawang/Jagorawi)
        graph.addEdge("Taman Mini", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 18: Merak Link (Already covered in Phase 1 logic ideally, but explicit here)
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
        graph.addEdge("Jakarta", "Sentul Selatan", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 4: Cijago -> Jagorawi
        graph.addEdge("Cimanggis", "Cisalak", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 7: Cimanggis-Cibitung -> Jagorawi
        graph.addJunction("Jatikarya", "Cimanggis");

        // Island 11: Cimanggis-Nagrak -> Jagorawi
        // 'Cimanggis' is the node.

        // Island 5: Desari -> Hub
        graph.addEdge("Antasari", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 6: Becakayu -> Hub
        graph.addEdge("Casablanca", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 10: 6 Ruas -> Hub
        graph.addEdge("Kelapa Gading", "Cawang", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 8: Jkt-Tangerang / Airport
        graph.addJunction("JC Benda", "Prof.Dr.Ir.Soedijatmo");

        // Trans Sumatera Stitches
        // Kramasan (Kayu Agung - Palembang) <-> Palembang
        graph.addJunction("Kramasan", "Palembang");

        // --- PHASE 4 FIXES (Final Stitching) ---

        // Island 2 Fix: Connect Cijago/Cimanggis to Jagorawi Hub
        graph.addEdge("Jakarta", "Cimanggis", { "Gol I": 0, "Gol II": 0, "Gol III": 0, "Gol IV": 0, "Gol V": 0 });

        // Island 3 Fix: Surabaya-Gresik (Dupak) -> Waru
        graph.addJunction("Waru", "Dupak");

        // Island 4 Fix: Soroja (Pasir Koja) -> Padaleunyi (Padalarang/Cileunyi)
        // Pasir Koja is between them. Link to Padalarang for connectivity.
        graph.addJunction("Padalarang", "Pasir Koja");

        // Island 5 Fix: Pandaan-Malang -> Gempol-Pandaan
        graph.addJunction("Gempol", "Pandaan");

        // Island 6 Fix: KLBM (Wringinanom) -> Mojokerto (Trans Jawa)
        graph.addJunction("Mojokerto", "SS Wringinanom");

        // Island 7 Fix: Serang-Panimbang (Walatanka) -> Tangerang-Merak (Serang Timur)
        graph.addJunction("Serang Timur", "Junction Walatanka");

        // Island 8 Fix: Semarang-Demak (Sayung) -> Semarang
        graph.addJunction("Semarang", "Sayung");

        // --- BONUS: Sumatra Connectivity ---

        // Medan Area: Connect Belmera (Tg Morawa) to Medan-Binjai (Tg Mulia)
        graph.addJunction("Tanjung Morawa", "Tanjung Mulia");

        // Tebing Tinggi - Indrapura Link
        graph.addJunction("IC Tebing Tinggi", "Indrapura");

        // Indrapura Hub (Kisaran Line vs Kuala Tanjung Line)
        graph.addJunction("Indrapura", "IC Indrapura");

        // --- SULAWESI STITCH ---
        // Ujung Pandang (City) <-> Jembatan Tallo (Port/Airport Access)
        graph.addJunction("Ujung Pandang seksi 1,2 dan 3", "Jembatan Tallo");

        console.log("Graph built with " + graph.gates.size + " gates. Connectivity Optimized.");

    } catch (err) {
        console.error("Build Graph Error", err);
        alert("Gagal memproses data tarif: " + err.message);
    }
}

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

// No longer populating select options directly


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
        // window.scrollTo(0, 0); // User Request: Disable Auto Scroll

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

    // VALIDATION UPDATE: Allow Origin == Destination ONLY IF valid rate exists
    // (e.g. "Prof.Dr.Ir.Soedijatmo" -> "Prof.Dr.Ir.Soedijatmo" has a tariff)
    let isDirectSelfLoop = false;
    if (selectedOrigin === selectedDestination) {
        const neighbors = graph.adj.get(selectedOrigin);
        if (neighbors) {
            const selfEdge = neighbors.find(n => n.node === selectedDestination);
            if (selfEdge) {
                isDirectSelfLoop = true;
            }
        }

        if (!isDirectSelfLoop) {
            alert("Gerbang Asal dan Tujuan tidak boleh sama.");
            return;
        }
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
    // Re-run island check and show in UI
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

    // Valid fragmentation (Sumatra, Java, Bali, Sulawesi, Kalimantan, etc.)
    // If islands count is <= 15, we assume it's normal geographical separation.
    if (islands.length > 1) {
        const isCritical = islands.length > 15;
        const debugDiv = document.createElement('div');

        if (isCritical) {
            debugDiv.style.backgroundColor = '#fee2e2'; // Red
            debugDiv.style.color = '#991b1b';
            debugDiv.innerText = `⚠️ SYSTEM WARNING: Data terputus menjadi ${islands.length} bagian (Indikasi Error).\n`;
        } else {
            debugDiv.style.backgroundColor = '#eff6ff'; // Blue
            debugDiv.style.color = '#1e3a8a';
            debugDiv.innerText = `ℹ️ INFO JARINGAN: Terdeteksi ${islands.length} cluster tol (Jawa, Sumatera, Bali, dll).\n`;
        }

        debugDiv.style.padding = '10px';
        debugDiv.style.marginTop = '10px';
        debugDiv.style.borderRadius = '8px';
        debugDiv.style.fontSize = '11px';

        // Only show detailed list if it's critical or user expands it
        const detailedList = islands.map((isl, i) => `- Cluster ${i + 1}: ${isl[0]}... (${isl.length} gerbang)`).join('\n');
        // Truncate detail if too long for Info
        if (!isCritical) {
            debugDiv.title = detailedList; // Show on hover
            debugDiv.innerText += "(Klik untuk detail)";
            debugDiv.onclick = () => alert(detailedList);
        } else {
            debugDiv.innerText += detailedList;
        }

        document.querySelector('.app-container').appendChild(debugDiv);
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

// Start App
init();
