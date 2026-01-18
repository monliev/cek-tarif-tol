const rawData = `
[... full text provided by user ...]
`;

// Logic to parse this specific format:
// 1. Split lines.
// 2. Identify "Ruas" (first column).
// 3. Identify "Asal" (3rd column), "Tujuan" (4th column).
// 4. Identify Prices (column 5 onwards).
// 5. Construct JSON object.

const tollData = {
    "Tangerang-Merak": [
        // ... generated from text
    ],
    // ... other ruas
};
