/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

const FHIRValidator = require('./validator');

async function createValidatorInstance(cliContext) {
    const validator = new FHIRValidator(cliContext);
    const isExternal = cliContext && cliContext.validatorUrl && cliContext.validatorUrl !== 'internal';
    if (!isExternal) {
        console.log('ℹ️ Using internal validator...');
        await validator.startValidator()
    } else {
        console.log(`ℹ️ Using external validator at ${cliContext.validatorUrl}...`);
    }
    if (!cliContext) {
        validator.shutdown();
        return validator;
    };
    await validator.initializeSession();
    return validator;
}

module.exports = createValidatorInstance;

