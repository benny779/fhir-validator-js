const FHIRValidator = require('./validator');

async function createValidatorInstance(cliContext) {
    const validator = new FHIRValidator(cliContext);
    await validator.startValidator();
    if (!cliContext) {
        validator.shutdown();
        return undefined
    };
    await validator.initializeSession();
    return validator;
}

module.exports = createValidatorInstance;

