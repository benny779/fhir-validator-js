# FHIR Validator JS

A Node.js module that wraps the **[HL7 Java Validator Wrapper](https://github.com/hapifhir/org.hl7.fhir.validator-wrapper)**, handling **installation, version checks, and validation sessions**. It ensures an instance of the validator runs while supporting multiple concurrent validation sessions.

This module:
- **Ensures** the required OpenJDK version is installed (using Adoptium JRE).
- **Downloads & runs** the latest version of the FHIR Validator CLI JAR.
- **Manages validation sessions**, allowing different IG contexts & configurations.
- **Keeps validation sessions alive** to prevent cache reset that impacts performance.

## 🚀 Features
- ✅ Automatic installation of JDK and Validator JAR  
- ✅ Automatic validator-wrapper server startup (only if not already running)  
- ✅ Session-based validation (supports multiple configurations)  
- ✅ Keep-alive mechanism to maintain active sessions  
- ✅ Cross-platform support (Windows, macOS, Linux)  

---

## 📦 Installation

Install via npm:
```
npm install fhir-validator-js
```

---

## 🛠 Setup & Usage

### 1️⃣ Import & Initialize the Validator
```
const createValidatorInstance = require('fhir-validator-js');

(async () => {
    const validator = await createValidatorInstance({
        sv: "4.0.1",
        igs: ["il.core.fhir.r4#0.16.2"],
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

    const result = await validator.validate(resource);
    console.log("Validation Result:", JSON.stringify(result, null, 2));

    // Shutdown keep-alive mechanism
    validator.shutdown();
})();
```

---

## ⚙️ Configuration Options
The validator wrapper can be configured via:
- Environment variables
- Constructor options

### 🌍 Environment Variables
You can define these before running your application:
```
export FHIR_VALIDATOR_JDK_PATH=/path/to/jdk
export FHIR_VALIDATOR_JAR_PATH=/path/to/validator_cli.jar
export FHIR_VALIDATOR_NO_AUTO_INSTALL=true
```

### 📌 Constructor Parameters
```
const validator = await createValidatorInstance({
    sv: "4.0.1",
    igs: ["il.core.fhir.r4#0.16.2"],
    locale: "en",
    noAutoInstall: false,
    jdkPath: "/custom/jdk/path",
    jarPath: "/custom/jar/path"
});
```
Options provided as parameters override environment variables.

---

## 🔍 License

This project is licensed under the **Apache License 2.0**.

### 📜 Dependencies & Their Licenses:

- **FHIR Validator (Apache 2.0)** - [HL7 FHIR Validator](https://github.com/hapifhir/org.hl7.fhir.validator-wrapper)
- **OpenJDK (GPLv2 + Classpath Exception)** - [OpenJDK](https://openjdk.org/)

---

## 🤝 Contributing
Pull requests are welcome! If you encounter any issues or have feature requests, feel free to open an issue.

---


