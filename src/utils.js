/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */
import fs from 'fs-extra';
import { join, basename } from 'path';
import axios from 'axios';
import { log, logError } from './logger.js';
import { jdkPath, jarPath } from './paths.js';

const ADOPTIUM_JDK_URL = 'https://api.github.com/repos/adoptium/temurin21-binaries/releases/latest';
const YAFVA_JAR_URL = 'https://api.github.com/repos/Outburn-IL/yafva.jar/releases/latest';

function clearOldJdkVersions() {
  if (fs.existsSync(jdkPath)) {
    log('🧹 Clearing old JDK versions...');
    fs.emptyDirSync(jdkPath);
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
  log('📦 Installing OpenJDK...');

  // Ensure the JDK directory exists before downloading
  fs.ensureDirSync(jdkPath);

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
  const jdkFile = join(jdkPath, basename(jdkUrl));

  log(`⬇ Downloading OpenJDK from: ${jdkUrl}`);

  // Ensure the file stream is correctly opened before writing
  const writer = fs.createWriteStream(jdkFile);
  const jdkResponse = await axios({ url: jdkUrl, responseType: 'stream' });

  return new Promise((resolve, reject) => {
    jdkResponse.data.pipe(writer);
    writer.on('finish', () => {
      log('✅ OpenJDK downloaded.');
      resolve();
    });
    writer.on('error', (err) => {
      logError(`❌ JDK download failed: ${err.message}`);
      reject(err);
    });
  }).then(async () => {
    log('📦 Extracting OpenJDK...');
    if (jdkFile.endsWith('.zip')) {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(jdkFile);
      zip.extractAllTo(jdkPath, true);
    } else if (jdkFile.endsWith('.tar.gz')) {
      const tar = (await import('tar')).default;
      await tar.x({ file: jdkFile, cwd: jdkPath });
    } else {
      throw new Error('❌ Unsupported archive format for JDK.');
    }

    log('✅ OpenJDK installed.');
  });
}

/**
 * Detects the extracted JDK directory dynamically.
 * @returns {string} Path to the latest JDK bin folder
 */
function getJdkBinPath() {
  if (!fs.existsSync(jdkPath)) {
    throw new Error(`JDK directory not found at ${jdkPath}`);
  }

  const extractedFolders = fs.readdirSync(jdkPath).filter(folder =>
    folder.startsWith('jdk') || folder.startsWith('jre')
  );

  if (extractedFolders.length === 0) {
    throw new Error('No valid JRE folder found in extracted files.');
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
  return join(jdkPath, latestJreFolder, 'bin');
}

/**
 * Returns the full path to the Java executable.
 * @returns {string} Path to the Java binary
 */
function getJavaExecutable() {
  const { os } = getOsArchitecture();
  if (os === 'linux' )  return  'java';
  
  const binPath = getJdkBinPath();
  return process.platform === 'win32'
    ? join(binPath, 'java.exe')
    : join(binPath, 'java');
}

/**
 * Fetches the latest YAFVA.JAR URL from GitHub Releases.
 */
async function getLatestYafvaJarUrl() {
  try {
    log('🔎 Checking latest YAFVA.JAR release...');
    const response = await axios.get(YAFVA_JAR_URL);
    const assets = response.data.assets;

    const jarAsset = assets.find(asset => asset.name.startsWith('yafva-') && asset.name.endsWith('.jar'));
    if (!jarAsset) {
      throw new Error('YAFVA.JAR not found in the latest release.');
    }

    log(`✅ Latest YAFVA.JAR Version: ${response.data.tag_name}`);
    return jarAsset.browser_download_url;
  } catch (error) {
    logError('❌ Failed to fetch the latest YAFVA.JAR release.');
    throw error;
  }
}

/**
* Downloads the latest YAFVA.JAR.
*/
async function downloadYafvaJar() {
  if (fs.existsSync(jarPath)) {
    log('✅ YAFVA.JAR already installed.');
    return;
  }

  const jarUrl = await getLatestYafvaJarUrl();
  log(`⬇ Downloading YAFVA.JAR from: ${jarUrl}`);

  const writer = fs.createWriteStream(jarPath);
  const response = await axios({ url: jarUrl, responseType: 'stream' });

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', () => {
      log('✅ YAFVA.JAR downloaded.');
      resolve();
    });
    writer.on('error', (err) => {
      logError(`❌ YAFVA.JAR download failed: ${err.message}`);
      reject(err);
    });
  });
}

export {
  getOsArchitecture,
  downloadAndExtractJDK,
  clearOldJdkVersions,
  getJdkBinPath,
  getJavaExecutable,
  downloadYafvaJar
};
