const createValidatorInstance = require('../src/index');
const deepDiff = require('deep-diff').diff;

// Function to remove non-essential fields before comparison
function cleanValidationResult(result) {
    result.issues.forEach(issue => {
        delete issue.messageId;
        delete issue.col;
        delete issue.slicingHint;
        delete issue.signpost;
        delete issue.criticalSignpost;
        delete issue.matched;
        delete issue.ignorableError;
        delete issue.count;
        delete issue.html;          // ✅ Ignore extra "html" fields
        delete issue.sliceHtml;     // ✅ Ignore extra "sliceHtml"
        delete issue.sliceText;     // ✅ Ignore extra "sliceText"
        delete issue.sliceInfo;     // ✅ Ignore extra "sliceInfo"
        delete issue.invId;         // ✅ Ignore extra "invId"
    });

    return result;
}

const expectedResult1 = {
    "issues": [
      {
        "source": "InstanceValidator",
        "line": 1,
        "col": 79,
        "location": "Patient.name[0]",
        "message": "This element does not match any known slice defined in the profile http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0 (this may not be a problem, but you should check that it's not intended to match a slice)",
        "messageId": "Details_for__matching_against_Profile_",
        "type": "INFORMATIONAL",
        "level": "INFORMATION",
        "html": "This element does not match any known slice defined in the profile http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0 (this may not be a problem, but you should check that it's not intended to match a slice)",
        "sliceHtml": "This element does not match any known slice Defined in the profile http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0 (this may not be a problem, but you should check that it's not intended to match a slice)<ul><li>Patient.name[0]: discriminator = true and ('he' in extension('http://hl7.org/fhir/StructureDefinition/language').value)</li>, <li>Patient.name[0]: discriminator = true and ('en' in extension('http://hl7.org/fhir/StructureDefinition/language').value)</li>, <li>Patient.name[0]: discriminator = true and ('ar' in extension('http://hl7.org/fhir/StructureDefinition/language').value)</li></ul>",
        "sliceText": [
          "Patient.name[0]: Does not match slice 'Hebrew' (discriminator: ('he' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
          "Patient.name[0]: Does not match slice 'English' (discriminator: ('en' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
          "Patient.name[0]: Does not match slice 'Arabic' (discriminator: ('ar' in extension('http://hl7.org/fhir/StructureDefinition/language').value))"
        ],
        "slicingHint": true,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "sliceInfo": [
          {
            "source": "InstanceValidator",
            "line": 1,
            "col": 79,
            "location": "Patient.name[0]",
            "message": "Does not match slice 'Hebrew' (discriminator: ('he' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "messageId": "Details_for__matching_against_Profile_",
            "type": "STRUCTURE",
            "level": "INFORMATION",
            "html": "Does not match slice 'Hebrew' (discriminator: ('he' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "sliceHtml": "discriminator = true and ('he' in extension('http://hl7.org/fhir/StructureDefinition/language').value)",
            "slicingHint": true,
            "signpost": false,
            "criticalSignpost": false,
            "matched": false,
            "ignorableError": false,
            "count": 0
          },
          {
            "source": "InstanceValidator",
            "line": 1,
            "col": 79,
            "location": "Patient.name[0]",
            "message": "Does not match slice 'English' (discriminator: ('en' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "messageId": "Details_for__matching_against_Profile_",
            "type": "STRUCTURE",
            "level": "INFORMATION",
            "html": "Does not match slice 'English' (discriminator: ('en' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "sliceHtml": "discriminator = true and ('en' in extension('http://hl7.org/fhir/StructureDefinition/language').value)",
            "slicingHint": true,
            "signpost": false,
            "criticalSignpost": false,
            "matched": false,
            "ignorableError": false,
            "count": 0
          },
          {
            "source": "InstanceValidator",
            "line": 1,
            "col": 79,
            "location": "Patient.name[0]",
            "message": "Does not match slice 'Arabic' (discriminator: ('ar' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "messageId": "Details_for__matching_against_Profile_",
            "type": "STRUCTURE",
            "level": "INFORMATION",
            "html": "Does not match slice 'Arabic' (discriminator: ('ar' in extension('http://hl7.org/fhir/StructureDefinition/language').value))",
            "sliceHtml": "discriminator = true and ('ar' in extension('http://hl7.org/fhir/StructureDefinition/language').value)",
            "slicingHint": true,
            "signpost": false,
            "criticalSignpost": false,
            "matched": false,
            "ignorableError": false,
            "count": 0
          }
        ],
        "count": 0
      },
      {
        "source": "InstanceValidator",
        "line": 1,
        "col": 81,
        "location": "Patient",
        "message": "Patient.identifier: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "messageId": "Validation_VAL_Profile_Minimum",
        "type": "STRUCTURE",
        "level": "ERROR",
        "html": "Patient.identifier: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "count": 0
      },
      {
        "source": "InstanceValidator",
        "line": 1,
        "col": 81,
        "location": "Patient",
        "message": "Patient.gender: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "messageId": "Validation_VAL_Profile_Minimum",
        "type": "STRUCTURE",
        "level": "ERROR",
        "html": "Patient.gender: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "count": 0
      },
      {
        "source": "InstanceValidator",
        "line": 1,
        "col": 81,
        "location": "Patient",
        "message": "Patient.birthDate: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "messageId": "Validation_VAL_Profile_Minimum",
        "type": "STRUCTURE",
        "level": "ERROR",
        "html": "Patient.birthDate: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "count": 0
      },
      {
        "source": "InstanceValidator",
        "line": 1,
        "col": 81,
        "location": "Patient",
        "message": "Constraint failed: dom-6: 'A resource should have narrative for robust management' (defined in http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)",
        "messageId": "http://hl7.org/fhir/StructureDefinition/DomainResource#dom-6",
        "type": "INVARIANT",
        "level": "WARNING",
        "html": "Constraint failed: dom-6: 'A resource should have narrative for robust management' (defined in http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "invId": "http://hl7.org/fhir/StructureDefinition/DomainResource#dom-6",
        "count": 0
      }
    ]
  };

const expectedResult2 = {
    "issues": [
        {
        "source": "InstanceValidator",
        "line": 1,
        "col": 109,
        "location": "Patient.meta.profile[0]",
        "message": "Canonical URL 'http://il-core-patient-error.com' does not resolve",
        "messageId": "TYPE_SPECIFIC_CHECKS_DT_CANONICAL_RESOLVE",
        "type": "INVALID",
        "level": "INFORMATION",
        "html": "Canonical URL 'http://il-core-patient-error.com' does not resolve",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "count": 0
        },
        {
        "source": "InstanceValidator",
        "line": 1,
        "col": 166,
        "location": "Patient",
        "message": "Constraint failed: dom-6: 'A resource should have narrative for robust management' (defined in http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)",
        "messageId": "http://hl7.org/fhir/StructureDefinition/DomainResource#dom-6",
        "type": "INVARIANT",
        "level": "WARNING",
        "html": "Constraint failed: dom-6: 'A resource should have narrative for robust management' (defined in http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "invId": "http://hl7.org/fhir/StructureDefinition/DomainResource#dom-6",
        "count": 0
        },
        {
        "source": "InstanceValidator",
        "line": 1,
        "col": 166,
        "location": "Patient.meta.profile[0]",
        "message": "Profile reference 'http://il-core-patient-error.com' has not been checked because it could not be found, and fetching it resulted in the error The URL 'http://il-core-patient-error.com' is not known to the FHIR validator, and has not been provided as part of the setup / parameters",
        "messageId": "VALIDATION_VAL_PROFILE_UNKNOWN_ERROR_NETWORK",
        "type": "STRUCTURE",
        "level": "WARNING",
        "html": "Profile reference 'http://il-core-patient-error.com' has not been checked because it could not be found, and fetching it resulted in the error The URL 'http://il-core-patient-error.com' is not known to the FHIR validator, and has not been provided as part of the setup / parameters",
        "slicingHint": false,
        "signpost": false,
        "criticalSignpost": false,
        "matched": false,
        "ignorableError": false,
        "count": 0
        }
    ]
};

(async () => {
    const validator1 = await createValidatorInstance({
        sv: "4.0.1",
        igs: ["il.core.fhir.r4#0.16.2"]
    });

    const validator2 = await createValidatorInstance({
        sv: "4.0.1",
        igs: []
    });

    const resource = {
        resourceType: "Patient",
        meta: {
            profile: ["http://il-core-patient-error.com"]
        },
        id: "123",
        name: [{ given: ["John"], family: "Doe" }]
    };

    const resourceNoMeta = { ... resource};
    delete resourceNoMeta.meta;

    const result1 = await validator1.validate(resourceNoMeta, ["http://fhir.health.gov.il/StructureDefinition/il-core-patient"]);
    const result2 = await validator2.validate(resource);
    console.log("Validation 1 Result:", JSON.stringify(result1, null, 2));
    console.log("Validation 2 Result:", JSON.stringify(result2, null, 2));

    // Properly cleanup keep-alive process
    validator1.shutdown();
    validator2.shutdown();

    // Clean actual and expected results before comparison
    const cleanedResult1 = cleanValidationResult(result1);
    const cleanedExpected1 = cleanValidationResult(expectedResult1);
    const cleanedResult2 = cleanValidationResult(result2);
    const cleanedExpected2 = cleanValidationResult(expectedResult2);

    // Compare expected vs actual result (excluding ignored fields)
    const differences1 = deepDiff(cleanedResult1, cleanedExpected1);
    const differences2 = deepDiff(cleanedResult2, cleanedExpected2);

    if (!differences1) {
        console.log("✅ Test 1 Passed: Validation results match expected output.");
    } else {
        console.error("❌ Test 1 Failed: Validation results do not match expected output.");
        console.error("🔍 Differences:", JSON.stringify(differences1, null, 2));
        process.exit(1); // Failure exit code
    }

    if (!differences2) {
        console.log("✅ Test 2 Passed: Validation results match expected output.");
    } else {
        console.error("❌ Test 2 Failed: Validation results do not match expected output.");
        console.error("🔍 Differences:", JSON.stringify(differences2, null, 2));
        process.exit(1); // Failure exit code
    }

})();
