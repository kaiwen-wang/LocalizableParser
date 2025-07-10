const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_FILE = 'Localizable.xcstrings';
const OUTPUT_DIR = 'output_chunks';
// -------------------

// Helper function to create a directory if it doesn't exist
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        console.log(`Creating output directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Main function to process the file
function processXcstrings() {
    console.log(`Reading file: ${INPUT_FILE}`);

    // 1. Read and parse the input JSON file
    let xcstringsData;
    try {
        const fileContent = fs.readFileSync(INPUT_FILE, 'utf8');
        xcstringsData = JSON.parse(fileContent);
    } catch (error) {
        console.error(`Error reading or parsing ${INPUT_FILE}:`, error.message);
        if (error instanceof SyntaxError) {
            console.error("This often means the JSON is invalid. Please ensure it's a complete and correct JSON file.");
        }
        return;
    }

    const { sourceLanguage, version, strings } = xcstringsData;
    if (!strings || typeof strings !== 'object') {
        console.error("The '.xcstrings' file does not have a valid 'strings' object.");
        return;
    }

    // Ensure the output directory exists
    ensureDirectoryExists(OUTPUT_DIR);

    const keys = Object.keys(strings);
    console.log(`Found ${keys.length} localization keys to process.`);

    // --- TASK 1: Splitting into single files ---
    keys.forEach((key, index) => {
        const stringEntry = strings[key];

        // Create a new JSON object for this single key
        const chunk = {
            "sourceLanguage": sourceLanguage,
            "version": version,
            "strings": {
                [key]: stringEntry
            }
        };

        // Sanitize the key to create a valid filename
        // Replaces slashes, newlines, and other problematic characters with underscores
        const safeFileName = `key_${index + 1}_${key.replace(/[\n\r\s/\\%:*?"<>|]/g, '_').substring(0, 50)}.json`;
        const outputPath = path.join(OUTPUT_DIR, safeFileName);

        // Write the chunk to its own file
        fs.writeFileSync(outputPath, JSON.stringify(chunk, null, 2));
    });
    console.log(`\n✅ Successfully split the file into ${keys.length} chunks in the '${OUTPUT_DIR}' directory.`);


    // --- TASK 2: Finding keys with missing translations ---
    console.log("\n🔍 Checking for missing translations...");

    // First, determine the full set of all possible languages in the file
    const allLangs = new Set();
    keys.forEach(key => {
        if (strings[key].localizations) {
            Object.keys(strings[key].localizations).forEach(lang => allLangs.add(lang));
        }
    });
    const allLangsArray = Array.from(allLangs);
    console.log(`Detected ${allLangsArray.length} total languages: ${allLangsArray.join(', ')}`);

    const missingReport = [];

    keys.forEach(key => {
        // We can ignore keys with no localizations object at all, like the empty key "" you provided
        if (!strings[key].localizations) {
            return;
        }

        const availableLangs = new Set(Object.keys(strings[key].localizations));
        const missingLangs = allLangsArray.filter(lang => !availableLangs.has(lang));

        if (missingLangs.length > 0) {
            missingReport.push({
                key: key.replace(/\n/g, "\\n"), // Make the key readable in a single line
                missing: missingLangs
            });
        }
    });

    if (missingReport.length > 0) {
        console.log(`\n🚨 Found ${missingReport.length} keys with missing translations:`);
        missingReport.forEach(report => {
            console.log(`- Key: "${report.key}"`);
            console.log(`  Missing: ${report.missing.join(', ')}\n`);
        });
    } else {
        console.log("\n✅ All keys have entries for all detected languages. No missing translations found.");
    }
}


// --- Execute the script ---

// Note: Your provided JSON was incomplete. I've added the closing braces to make it valid.
// Make sure your actual 'Localizable.xcstrings' file is a complete and valid JSON.
processXcstrings();