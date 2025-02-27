const createValidatorInstance = require('../src/index');
const deepDiff = require('deep-diff').diff;

// Function to remove non-essential fields before comparison
function cleanValidationResult(result) {
    result.outcomes.forEach(outcome => {
        outcome.issues.forEach(issue => {
            delete issue.messageId;
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
    });

    delete result.sessionId; // Ignore dynamic sessionId
    delete result.validationTimes; // Ignore variable validation times

    return result;
}

const expectedResult1 = {
    "outcomes": [
        {
            "fileInfo": {
                "fileName": "resource.json",
                "fileContent": "{\"resourceType\":\"Patient\",\"meta\":{\"profile\":[\"http://fhir.health.gov.il/StructureDefinition/il-core-patient\"]},\"id\":\"123\",\"name\":[{\"given\":[\"John\"],\"family\":\"Doe\"}]}",
                "fileType": "json"
            },
            "issues": [
                {
                    "source": "InstanceValidator",
                    "line": 1,
                    "col": 166,
                    "location": "Patient",
                    "message": "Constraint failed: dom-6: 'A resource should have narrative for robust management' (defined in http://hl7.org/fhir/StructureDefinition/DomainResource) (Best Practice Recommendation)",
                    "type": "INVARIANT",
                    "level": "WARNING"
                },
                {
                    "source": "InstanceValidator",
                    "line": 1,
                    "col": 164,
                    "location": "Patient.name[0]",
                    "message": "This element does not match any known slice defined in the profile http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0 (this may not be a problem, but you should check that it's not intended to match a slice)",
                    "type": "INFORMATIONAL",
                    "level": "INFORMATION"
                },
                {
                    "source": "InstanceValidator",
                    "line": 1,
                    "col": 166,
                    "location": "Patient",
                    "message": "Patient.identifier: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
                    "type": "STRUCTURE",
                    "level": "ERROR"
                },
                {
                    "source": "InstanceValidator",
                    "line": 1,
                    "col": 166,
                    "location": "Patient",
                    "message": "Patient.gender: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
                    "type": "STRUCTURE",
                    "level": "ERROR"
                },
                {
                    "source": "InstanceValidator",
                    "line": 1,
                    "col": 166,
                    "location": "Patient",
                    "message": "Patient.birthDate: minimum required = 1, but only found 0 (from http://fhir.health.gov.il/StructureDefinition/il-core-patient|0.16.0)",
                    "type": "STRUCTURE",
                    "level": "ERROR"
                }
            ]
        }
    ]
};

const expectedResult2 = {
    "outcomes": [
      {
        "fileInfo": {
          "fileName": "resource.json",
          "fileContent": "{\"resourceType\":\"Patient\",\"meta\":{\"profile\":[\"http://fhir.health.gov.il/StructureDefinition/il-core-patient\"]},\"id\":\"123\",\"name\":[{\"given\":[\"John\"],\"family\":\"Doe\"}]}",
          "fileType": "json"
        },
        "issues": [
          {
            "source": "InstanceValidator",
            "line": 1,
            "col": 109,
            "location": "Patient.meta.profile[0]",
            "message": "Canonical URL 'http://fhir.health.gov.il/StructureDefinition/il-core-patient' does not resolve",
            "messageId": "TYPE_SPECIFIC_CHECKS_DT_CANONICAL_RESOLVE",
            "type": "INVALID",
            "level": "INFORMATION",
            "html": "Canonical URL 'http://fhir.health.gov.il/StructureDefinition/il-core-patient' does not resolve",
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
            "message": "Profile reference 'http://fhir.health.gov.il/StructureDefinition/il-core-patient' has not been checked because it could not be found, and the host fhir.health.gov.il cannot be found",
            "messageId": "VALIDATION_VAL_PROFILE_UNKNOWN_ERROR_NETWORK",
            "type": "STRUCTURE",
            "level": "WARNING",
            "html": "Profile reference 'http://fhir.health.gov.il/StructureDefinition/il-core-patient' has not been checked because it could not be found, and the host fhir.health.gov.il cannot be found",
            "slicingHint": false,
            "signpost": false,
            "criticalSignpost": false,
            "matched": false,
            "ignorableError": false,
            "count": 0
          }
        ]
      }
    ],
    "sessionId": "9186886f-7a17-448e-81ea-a3880d47641b",
    "validationTimes": {}
};

(async () => {
    const validator1 = await createValidatorInstance({
        sv: "4.0.1",
        igs: ["il.core.fhir.r4#0.16.2"],
        locale: "en"
    });

    const validator2 = await createValidatorInstance({
        sv: "4.0.1",
        locale: "en"
    });

    const resource = {
        resourceType: "Patient",
        meta: {
            profile: ["http://fhir.health.gov.il/StructureDefinition/il-core-patient"]
        },
        id: "123",
        name: [{ given: ["John"], family: "Doe" }]
    };

    const result1 = await validator1.validate(resource);
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
    const differences1 = deepDiff(cleanedResult1.outcomes, cleanedExpected1.outcomes);
    const differences2 = deepDiff(cleanedResult2.outcomes, cleanedExpected2.outcomes);

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
