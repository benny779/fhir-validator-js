# FHIR Validator JS

A Node.js module that wraps **[YAFVA.JAR](https://github.com/Outburn-IL/yafva.jar)**.

This module:
- **Ensures** the required OpenJDK version is installed (using Adoptium JRE).
- **Downloads & runs** the latest version of YAFVA.JAR.

## 🚀 Features
- ✅ Automatic installation of JDK and YAFVA.JAR  
- ✅ Automatic YAFVA.JAR server startup (only if not already running)  
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

    // Shutdown the background YAFVA.JAR process
    validator.shutdown();
})();
```

---

## 🔍 License

This project is licensed under the **Apache License 2.0**.

### 📜 Dependencies & Their Licenses:

- **[YAFVA.JAR](https://github.com/Outburn-IL/yafva.jar) (Apache 2.0)**
- **OpenJDK (GPLv2 + Classpath Exception)** - [OpenJDK](https://openjdk.org/)

---

## 🤝 Contributing
Pull requests are welcome! If you encounter any issues or have feature requests, feel free to open an issue.

---


