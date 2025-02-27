const FHIRValidator = require('./validator');

async function createValidatorInstance(cliContext = {}) {
    const validator = new FHIRValidator({ cliContext });
    await validator.startValidator();
    await validator.initializeSession();
    return validator;
}

module.exports = createValidatorInstance;
