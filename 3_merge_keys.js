const fs = require('fs');
const path = require('path');

// --- Configuration ---
const COMPLETE_DIR = path.join('output', '2_complete');
const TRANSLATED_DIR = path.join('output', '3_translated');
const FINAL_OUTPUT_DIR = path.join('output', '4_final_xcstrings'); // New output directory
const FINAL_OUTPUT_FILENAME = 'Localizable.xcstrings';             // Original filename

// --- Main Logic ---
function mergeKeys() {
    console.log(`\n--- Running Script 3: Merging All Keys ---`);

    // Ensure the final output directory exists and is clean
    if (!fs.existsSync(FINAL_OUTPUT_DIR)) {
        fs.mkdirSync(FINAL_OUTPUT_DIR, { recursive: true });
    }
    const finalOutputPath = path.join(FINAL_OUTPUT_DIR, FINAL_OUTPUT_FILENAME);

    const finalJson = {
        sourceLanguage: "en",
        version: "1.0",
        strings: {}
    };

    const filePaths = [];
    if (fs.existsSync(COMPLETE_DIR)) {
        fs.readdirSync(COMPLETE_DIR).forEach(file => {
            if (file.endsWith('.json')) {
                filePaths.push(path.join(COMPLETE_DIR, file));
            }
        });
    }
    if (fs.existsSync(TRANSLATED_DIR)) {
        fs.readdirSync(TRANSLATED_DIR).forEach(file => {
            if (file.endsWith('.json')) {
                filePaths.push(path.join(TRANSLATED_DIR, file));
            }
        });
    }

    if (filePaths.length === 0) {
        console.error("ERROR: No files found in 'complete' or 'translated' directories. Nothing to merge.");
        return;
    }

    console.log(`Found ${filePaths.length} total key files to merge.`);

    filePaths.forEach((filePath, index) => {
        const chunkData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (index === 0) {
            finalJson.sourceLanguage = chunkData.sourceLanguage;
            finalJson.version = chunkData.version;
        }

        Object.assign(finalJson.strings, chunkData.strings);
    });

    // Sort keys alphabetically for consistency and better diffing in source control
    const sortedStrings = Object.keys(finalJson.strings).sort().reduce(
        (obj, key) => {
            obj[key] = finalJson.strings[key];
            return obj;
        },
        {}
    );
    finalJson.strings = sortedStrings;

    fs.writeFileSync(finalOutputPath, JSON.stringify(finalJson, null, 2));

    console.log(`\nMerging complete!`);
    console.log(`✅ Final merged file created at: ${finalOutputPath}`);
    console.log(`You can now copy this file back to your Xcode project.`);
}

mergeKeys();