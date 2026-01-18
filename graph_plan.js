// 1. Build Graph from existing `tollData`.
// Nodes = Gate Names
// Edges = Toll costs between gates
// Problem: tollData is Ruas-based. A gate in one Ruas (e.g. Cikopo) needs to link to another (Cikampek).
// Solution: Create a "Junction Map" to alias nodes or create 0-cost edges.

const junctions = [
    ["Merak", "Merak"], // Self
    ["Cikupa", "Cikupa"],
    // Connection: Jakarta-Tangerang <-> Tangerang-Merak
    ["Cikupa", "Cikupa"], // They share this gate? Actually usually separate barriers.
    // Let's assume user exits one and enters another. 
    // BUT the user wants "Merak to Cikampek".
    // Path: Merak -> Cikupa (Pay) -> Tomang (Pay) -> Cawang -> Cikampek.

    // Critical: We need to link the END of one segment to the START of the next.
    // Tangerang-Merak: Ends at Cikupa. 
    // Jkt-Tangerang: Starts at Tomang, Ends at Cikupa.
    // Link: Cikupa (TM) <-> Cikupa (JT). Cost = 0.

    // Jkt-Cikampek: Jakarta IC -> Cikampek. 
    // Cipali: Cikopo -> Palimanan.
    // Link: Cikampek (Japek) <-> Cikopo (Cipali). Cost = 0.

    // Cipali: Palimanan.
    // Palikanci: Palimanan -> Kanci.
    // Link: Palimanan (Cipali) <-> Palimanan (Palikanci). Cost = 0.

    // Palikanci: Kanci.
    // Kanci-Pejagan: Kanci -> Pejagan.
    // Link: Kanci <-> Kanci.

    // ... and so on.
];

// 2. Algorithm (Dijkstra)
// Inputs: Start Node, End Node.
// Output: Total Cost, Path (list of segments).

// 3. UI Changes
// Remove "Ruas Select".
// Single "Origin" select (searchable).
// Single "Destination" select (searchable).
// Logic: Flatten all gates into one list.
