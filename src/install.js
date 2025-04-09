/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */
import { downloadAndExtractJDK, downloadYafvaJar } from './utils.js';
import { log } from './logger.js';
import fs from 'fs-extra';
import { jdkPath, jarPath } from './paths.js';

async function setupIfNeeded() {
  log('🔧 Running setup...');

  if (!fs.existsSync(jdkPath)) {
    log('📦 Installing JDK...');
    await downloadAndExtractJDK();
  } else {
    log('✅ JDK is already installed.');
  }

  if (!fs.existsSync(jarPath)) {
    log('📦 Installing YAFVA.JAR...');
    await downloadYafvaJar();
  } else {
    log('✅ YAFVA.JAR is already installed.');
  }
}

(async () => {
  try {
    console.log('🚀 Starting installation...');
    await setupIfNeeded();
    console.log('✅ Installation completed successfully.');
  } catch (error) {
    console.error(`❌ Installation failed: ${error.message}`);
     
    process.exit(1);
  }
})();
