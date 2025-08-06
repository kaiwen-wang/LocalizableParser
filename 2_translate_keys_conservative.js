// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// --- Configuration ---
const NEEDS_TRANSLATION_DIR = path.join('output', '1_needs_translation');
const TRANSLATED_DIR = path.join('output', '3_translated');
const OPENAI_MODEL = "gpt-3.5-turbo";

// Conservative concurrency settings (adjust based on your API limits)
const MAX_CONCURRENT_FILES = 2; // Process up to 2 files simultaneously
const MAX_CONCURRENT_LANGUAGES = 2; // Translate up to 2 languages per file simultaneously
const API_DELAY_MS = 150; // Slightly reduced delay between API calls

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

// Simple queue-based rate limiter
class RateLimiter {
    constructor(maxConcurrent, delayMs = 0) {
        this.maxConcurrent = maxConcurrent;
        this.delayMs = delayMs;
        this.running = 0;
        this.queue = [];
    }

    async execute(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.running >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        this.running++;
        const { fn, resolve, reject } = this.queue.shift();

        try {
            const result = await fn();
            if (this.delayMs > 0) {
                await sleep(this.delayMs);
            }
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.processQueue();
        }
    }
}

// Create rate limiters
const fileRateLimiter = new RateLimiter(MAX_CONCURRENT_FILES);
const apiRateLimiter = new RateLimiter(MAX_CONCURRENT_LANGUAGES * MAX_CONCURRENT_FILES, API_DELAY_MS);

// Function to translate a single language for a key
async function translateLanguage(sourceText, sourceLang, langCode, comment, keyNumber) {
    return apiRateLimiter.execute(async () => {
        // Build the prompt dynamically, including the comment if it exists
        let prompt = `Translate the following text for an iOS app from ${sourceLang} to the language with code '${langCode}'. The text to translate is: "${sourceText}".`;

        if (comment) {
            const cleanComment = comment.replace(/"/g, '\\"').replace(/\n/g, ' ');
            prompt += ` A helpful comment for context is: "${cleanComment}".`;
        }

        prompt += ` Your response should ONLY contain the translated string, with no additional explanation, commentary, or quotation marks. Preserve placeholders like '%@', '%d', and '%1$@' exactly as they are.`;

        const response = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
        });

        const translation = response.choices[0].message.content.trim();
        console.log(`  Key #${keyNumber} [${langCode}] -> "${translation}"`);

        return {
            langCode,
            translation: {
                stringUnit: {
                    state: "translated",
                    value: translation
                }
            }
        };
    });
}

// Function to process a single file
async function processFile(file) {
    return fileRateLimiter.execute(async () => {
        const filePath = path.join(NEEDS_TRANSLATION_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const key = Object.keys(data.strings)[0];
        const stringEntry = data.strings[key];
        const sourceText = key;
        const sourceLang = data.sourceLanguage;
        const missingLangs = data._meta.missingLangs;

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

        // Process languages for this file with limited concurrency
        const translationPromises = missingLangs.map(langCode =>
            translateLanguage(sourceText, sourceLang, langCode, stringEntry.comment, keyNumber)
        );

        try {
            const results = await Promise.all(translationPromises);

            // Apply successful translations
            for (const result of results) {
                if (result.translation) {
                    stringEntry.localizations[result.langCode] = result.translation;
                }
            }

            // Save the translated file
            delete data._meta;
            const outputPath = path.join(TRANSLATED_DIR, file);
            fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

            console.log(`  ✅ Key #${keyNumber} completed`);

        } catch (error) {
            console.error(`  ERROR processing Key #${keyNumber}:`, error.message);
        }
    });
}

// --- Main Logic ---
async function translateKeys() {
    console.log(`\n--- Running Script 2: Translating Keys (Conservative Parallel Version) ---`);
    console.log(`Configuration:`);
    console.log(`  - Max concurrent files: ${MAX_CONCURRENT_FILES}`);
    console.log(`  - Max concurrent languages per file: ${MAX_CONCURRENT_LANGUAGES}`);
    console.log(`  - API delay: ${API_DELAY_MS}ms`);

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

    console.log(`\nFound ${filesToTranslate.length} keys to translate...`);

    const startTime = Date.now();

    // Process all files with controlled concurrency
    const filePromises = filesToTranslate.map(file => processFile(file));
    await Promise.all(filePromises);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(`\n🎉 Translation complete!`);
    console.log(`✅ All translated files are saved in: ${TRANSLATED_DIR}`);
    console.log(`⏱️  Total time: ${duration.toFixed(2)} seconds`);
}

translateKeys();