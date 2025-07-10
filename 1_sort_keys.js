const fs = require('fs');
const path = require('path');

// --- Configuration ---
const INPUT_FILE = 'Localizable.xcstrings';
const OUTPUT_DIR_BASE = 'output';
const NEEDS_TRANSLATION_DIR = path.join(OUTPUT_DIR_BASE, '1_needs_translation');
const COMPLETE_DIR = path.join(OUTPUT_DIR_BASE, '2_complete');

// --- Main Logic ---
function sortXcstrings() {
    console.log(`--- Running Script 1: Sorting Keys ---`);
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
        return;
    }

    if (fs.existsSync(OUTPUT_DIR_BASE)) {
        fs.rmSync(OUTPUT_DIR_BASE, { recursive: true, force: true });
    }
    fs.mkdirSync(NEEDS_TRANSLATION_DIR, { recursive: true });
    fs.mkdirSync(COMPLETE_DIR, { recursive: true });

    const xcstringsData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    const { sourceLanguage, version, strings } = xcstringsData;
    const allKeys = Object.keys(strings);

    const allLangs = new Set();
    allKeys.forEach(key => {
        if (strings[key].localizations) {
            Object.keys(strings[key].localizations).forEach(lang => allLangs.add(lang));
        }
    });
    const allLangsArray = Array.from(allLangs);
    console.log(`Discovered ${allLangsArray.length} total languages: ${allLangsArray.join(', ')}`);
    console.log(`Source language is '${sourceLanguage}'. It will be ignored when checking for missing translations.`);

    let needsTranslationCount = 0;
    let completeCount = 0;

    allKeys.forEach((key, index) => {
        const stringEntry = strings[key];
        const availableLangs = new Set(Object.keys(stringEntry.localizations || {}));

        // ===================================================================
        //  THE FIX IS HERE
        // ===================================================================
        // A language is missing IF it's not available AND it's NOT the source language.
        const missingLangs = allLangsArray.filter(
            (lang) => !availableLangs.has(lang) && lang !== sourceLanguage
        );
        // ===================================================================

        const chunk = {
            sourceLanguage,
            version,
            strings: { [key]: stringEntry },
            _meta: { missingLangs }
        };

        const safeFileName = `key_${index + 1}_${key.replace(/[\n\r\s/\\%:*?"<>|]/g, '_').substring(0, 50)}.json`;

        let outputPath;
        if (missingLangs.length > 0) {
            outputPath = path.join(NEEDS_TRANSLATION_DIR, safeFileName);
            needsTranslationCount++;
        } else {
            delete chunk._meta;
            outputPath = path.join(COMPLETE_DIR, safeFileName);
            completeCount++;
        }

        fs.writeFileSync(outputPath, JSON.stringify(chunk, null, 2));
    });

    console.log(`\nSorting complete!`);
    console.log(`✅ ${completeCount} keys are complete and located in: ${COMPLETE_DIR}`);
    console.log(`➡️ ${needsTranslationCount} keys need translation and are located in: ${NEEDS_TRANSLATION_DIR}`);
}

sortXcstrings();