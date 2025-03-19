/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { log, logError } = require('./logger');

const JDK_PATH = path.join(__dirname, '../../jdk');
const ADOPTIUM_JDK_URL = "https://api.github.com/repos/adoptium/temurin21-binaries/releases/latest";

function clearOldJdkVersions() {
    if (fs.existsSync(JDK_PATH)) {
        log("🧹 Clearing old JDK versions...");
        fs.emptyDirSync(JDK_PATH);
    }
}

function getOsArchitecture() {
    let os, arch;
    switch (process.platform) {
        case 'win32': os = 'windows'; break;
        case 'darwin': os = 'mac'; break;
        case 'linux': os = 'linux'; break;
        default: throw new Error(`Unsupported OS: ${process.platform}`);
    }

    switch (process.arch) {
        case 'x64': arch = 'x64'; break;
        case 'ia32': arch = 'x32'; break;
        case 'arm64': arch = 'aarch64'; break;
        default: throw new Error(`Unsupported architecture: ${process.arch}`);
    }

    return { os, arch };
}

async function downloadAndExtractJDK() {
    log("📦 Installing OpenJDK...");

    // Ensure the JDK directory exists before downloading
    fs.ensureDirSync(JDK_PATH);

    const response = await axios.get(ADOPTIUM_JDK_URL);
    const assets = response.data.assets;
    const { os, arch } = getOsArchitecture();

    const jdkAsset = assets.find(a =>
        a.name.includes(`jre_${arch}_${os}`) &&
        (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz'))
    );

    if (!jdkAsset) {
        throw new Error(`No matching JDK binary found for OS: ${os}, Arch: ${arch}`);
    }

    const jdkUrl = jdkAsset.browser_download_url;
    const jdkFile = path.join(JDK_PATH, path.basename(jdkUrl));

    log(`⬇ Downloading OpenJDK from: ${jdkUrl}`);

    // Ensure the file stream is correctly opened before writing
    const writer = fs.createWriteStream(jdkFile);
    const jdkResponse = await axios({ url: jdkUrl, responseType: 'stream' });

    return new Promise((resolve, reject) => {
        jdkResponse.data.pipe(writer);
        writer.on("finish", () => {
            log("✅ OpenJDK downloaded.");
            resolve();
        });
        writer.on("error", (err) => {
            logError(`❌ JDK download failed: ${err.message}`);
            reject(err);
        });
    }).then(async () => {
        log("📦 Extracting OpenJDK...");
        if (jdkFile.endsWith(".zip")) {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(jdkFile);
            zip.extractAllTo(JDK_PATH, true);
        } else if (jdkFile.endsWith(".tar.gz")) {
            const tar = require('tar');
            await tar.x({ file: jdkFile, cwd: JDK_PATH });
        } else {
            throw new Error("❌ Unsupported archive format for JDK.");
        }

        log("✅ OpenJDK installed.");
    });
}

/**
 * Detects the extracted JDK directory dynamically.
 * @returns {string} Path to the latest JDK bin folder
 */
function getJdkBinPath() {
    if (!fs.existsSync(JDK_PATH)) {
        throw new Error(`JDK directory not found at ${JDK_PATH}`);
    }

    const extractedFolders = fs.readdirSync(JDK_PATH).filter(folder =>
        folder.startsWith("jdk") || folder.startsWith("jre")
    );

    if (extractedFolders.length === 0) {
        throw new Error("No valid JRE folder found in extracted files.");
    }

    extractedFolders.sort((a, b) => {
        const versionA = a.match(/(\d+\.\d+\.\d+)/);
        const versionB = b.match(/(\d+\.\d+\.\d+)/);
        if (versionA && versionB) {
            return versionB[0].localeCompare(versionA[0], undefined, { numeric: true });
        }
        return 0;
    });

    const latestJreFolder = extractedFolders[0];
    return path.join(JDK_PATH, latestJreFolder, "bin");
}

/**
 * Returns the full path to the Java executable.
 * @returns {string} Path to the Java binary
 */
function getJavaExecutable() {
    const binPath = getJdkBinPath();
    return process.platform === "win32"
        ? path.join(binPath, "java.exe")
        : path.join(binPath, "java");
}

module.exports = {
    getOsArchitecture,
    downloadAndExtractJDK,
    clearOldJdkVersions,
    getJdkBinPath,       // ✅ Keeping the existing structure
    getJavaExecutable    // ✅ Adding this function while keeping everything else
};
