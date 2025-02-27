const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');
const { log, logError } = require('./logger');

const BIN_DIR = path.join(__dirname, '../../bin');
const JAR_PATH = path.join(BIN_DIR, 'validator.jar');
const GITHUB_API_URL = "https://api.github.com/repos/hapifhir/org.hl7.fhir.validator-wrapper/releases/latest";

/**
 * Fetches the latest FHIR Validator JAR URL from GitHub Releases.
 */
async function getLatestValidatorJarUrl() {
    try {
        log("🔎 Checking latest FHIR Validator release...");
        const response = await axios.get(GITHUB_API_URL);
        const assets = response.data.assets;

        const jarAsset = assets.find(asset => asset.name.includes('validator_cli.jar'));
        if (!jarAsset) {
            throw new Error("Validator CLI JAR not found in the latest release.");
        }

        log(`✅ Latest Validator Version: ${response.data.tag_name}`);
        return jarAsset.browser_download_url;
    } catch (error) {
        logError("❌ Failed to fetch the latest Validator release.");
        throw error;
    }
}

/**
 * Downloads the latest FHIR Validator JAR.
 */
async function downloadValidatorJar() {
    fs.ensureDirSync(BIN_DIR);

    if (fs.existsSync(JAR_PATH)) {
        log("✅ FHIR Validator JAR already installed.");
        return;
    }

    const jarUrl = await getLatestValidatorJarUrl();
    log(`⬇ Downloading Validator JAR from: ${jarUrl}`);

    const writer = fs.createWriteStream(JAR_PATH);
    const response = await axios({ url: jarUrl, responseType: 'stream' });

    return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", () => {
            log("✅ FHIR Validator JAR downloaded.");
            resolve();
        });
        writer.on("error", (err) => {
            logError(`❌ JAR download failed: ${err.message}`);
            reject(err);
        });
    });
}

module.exports = {
    downloadValidatorJar
};
