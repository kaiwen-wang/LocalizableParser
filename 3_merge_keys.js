const fs = require('fs');
const path = require('path');

// --- Configuration ---
const COMPLETE_DIR = path.join('output', '2_complete');
const TRANSLATED_DIR = path.join('output', '3_translated');
const FINAL_OUTPUT_FILE = 'Localizable.xcstrings.final.json';

// --- Main Logic ---
function mergeKeys() {
    console.log(`\n--- Running Script 3: Merging All Keys ---`);

    const finalJson = {
        sourceLanguage: "en", // Default, will be overwritten by first file
        version: "1.0",      // Default, will be overwritten
        strings: {}
    };

    const filePaths = [];
    if (fs.existsSync(COMPLETE_DIR)) {
        fs.readdirSync(COMPLETE_DIR).forEach(file => filePaths.push(path.join(COMPLETE_DIR, file)));
    }
    if (fs.existsSync(TRANSLATED_DIR)) {
        fs.readdirSync(TRANSLATED_DIR).forEach(file => filePaths.push(path.join(TRANSLATED_DIR, file)));
    }

    if (filePaths.length === 0) {
        console.error("ERROR: No files found in 'complete' or 'translated' directories. Nothing to merge.");
        return;
    }

    console.log(`Found ${filePaths.length} total keys to merge.`);

    filePaths.forEach((filePath, index) => {
        const chunkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // On the first file, grab the global metadata
        if (index === 0) {
            finalJson.sourceLanguage = chunkData.sourceLanguage;
            finalJson.version = chunkData.version;
        }

        // Merge the 'strings' object from the chunk into the final JSON
        Object.assign(finalJson.strings, chunkData.strings);
    });

    // Sort keys alphabetically for consistency
    const sortedStrings = Object.keys(finalJson.strings).sort().reduce(
        (obj, key) => {
            obj[key] = finalJson.strings[key];
            return obj;
        },
        {}
    );
    finalJson.strings = sortedStrings;

    fs.writeFileSync(FINAL_OUTPUT_FILE, JSON.stringify(finalJson, null, 2));

    console.log(`\nMerging complete!`);
    console.log(`✅ Final merged file created: ${FINAL_OUTPUT_FILE}`);
}

mergeKeys();