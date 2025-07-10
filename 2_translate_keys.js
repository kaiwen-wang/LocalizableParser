// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// --- Configuration ---
const NEEDS_TRANSLATION_DIR = path.join('output', '1_needs_translation');
const TRANSLATED_DIR = path.join('output', '3_translated');
const OPENAI_MODEL = "gpt-3.5-turbo";

// --- OpenAI Client Initialization ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper to prevent hitting API rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract the key number from a filename
const extractKeyNumber = (filename) => {
    const match = filename.match(/^key_(\d+)_/);
    return match ? parseInt(match[1], 10) : 0;
};

// --- Main Logic ---
async function translateKeys() {
    console.log(`\n--- Running Script 2: Translating Keys ---`);

    if (!process.env.OPENAI_API_KEY) {
        console.error("ERROR: OPENAI_API_KEY not found.");
        console.error("Please ensure you have a .env file with OPENAI_API_KEY='your_key_here'");
        return;
    }

    if (!fs.existsSync(NEEDS_TRANSLATION_DIR)) {
        console.log("No 'needs_translation' directory found. Nothing to do.");
        return;
    }
    if (!fs.existsSync(TRANSLATED_DIR)) {
        fs.mkdirSync(TRANSLATED_DIR, { recursive: true });
    }

    let filesToTranslate = fs.readdirSync(NEEDS_TRANSLATION_DIR).filter(f => f.endsWith('.json'));

    if (filesToTranslate.length === 0) {
        console.log("No files found in the translation directory. Nothing to do.");
        return;
    }

    filesToTranslate.sort((a, b) => extractKeyNumber(a) - extractKeyNumber(b));

    console.log(`Found ${filesToTranslate.length} keys to translate (processing in numerical order)...`);

    for (const file of filesToTranslate) {
        const filePath = path.join(NEEDS_TRANSLATION_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const key = Object.keys(data.strings)[0];
        const stringEntry = data.strings[key];
        const sourceText = key;
        const sourceLang = data.sourceLanguage;
        const missingLangs = data._meta.missingLangs;

        // --- NEW: Better logging with Key Number ---
        const keyNumber = extractKeyNumber(file);
        console.log(`\nProcessing Key #${keyNumber} (${file})`);
        console.log(`  Text: "${key.replace(/\n/g, "\\n")}"`);
        if (stringEntry.comment) {
            console.log(`  Comment: "${stringEntry.comment.replace(/\n/g, " ")}"`);
        }
        console.log(`  Missing languages: ${missingLangs.join(', ')}`);

        if (!stringEntry.localizations) {
            console.log("  -> Initializing 'localizations' object for this new key.");
            stringEntry.localizations = {};
        }

        for (const langCode of missingLangs) {
            try {
                // --- NEW: Dynamically build the prompt, including the comment if it exists ---
                let prompt = `Translate the following text for an iOS app from ${sourceLang} to the language with code '${langCode}'. The text to translate is: "${sourceText}".`;

                if (stringEntry.comment) {
                    const cleanComment = stringEntry.comment.replace(/"/g, '\\"').replace(/\n/g, ' ');
                    prompt += ` A helpful comment for context is: "${cleanComment}".`;
                }

                prompt += ` Your response should ONLY contain the translated string, with no additional explanation, commentary, or quotation marks. Preserve placeholders like '%@', '%d', and '%1$@' exactly as they are.`;

                const response = await openai.chat.completions.create({
                    model: OPENAI_MODEL,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.1,
                });

                const translation = response.choices[0].message.content.trim();
                console.log(`  [${langCode}] -> "${translation}"`);

                stringEntry.localizations[langCode] = {
                    stringUnit: {
                        state: "translated",
                        value: translation
                    }
                };

                await sleep(200);

            } catch (error) {
                console.error(`  ERROR translating to '${langCode}':`, error.message);
            }
        }

        delete data._meta;
        const outputPath = path.join(TRANSLATED_DIR, file);
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    }
    console.log(`\nTranslation complete!`);
    console.log(`✅ All translated files are saved in: ${TRANSLATED_DIR}`);
}

translateKeys();