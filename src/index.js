/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

import FHIRValidator from './validator.js';

async function createValidatorInstance(cliContext) {
  const validator = new FHIRValidator(cliContext);
  await validator.startValidator();
  return validator;
}

export { createValidatorInstance };
