const fs = require('fs');
const xml2js = require('xml2js');

async function parseSalesforceXml(xmlFile) {
    const data = fs.readFileSync(xmlFile, 'utf-8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(data);
    let plantumlOutput = ["@startuml"];

    const root = result.Flow;
    
    // Menangani variabel
    if (root.variables) {
        root.variables.forEach(varItem => {
            const name = varItem.name[0];
            const value = varItem.value?.[0]?.stringValue?.[0] || "";
            plantumlOutput.push(`:${name} = \"${value}\";`);
        });
    }

    // Menangani record lookups
    if (root.recordLookups) {
        root.recordLookups.forEach(lookup => {
            const name = lookup.name[0];
            const objectType = lookup.object[0];
            plantumlOutput.push(`:${name} = select * from ${objectType};`);
        });
    }

    // Menangani assignments
    if (root.assignments) {
        root.assignments.forEach(assign => {
            const label = assign.label[0];
            plantumlOutput.push(`:${label};`);
            assign.assignmentItems.forEach(item => {
                const ref = item.assignToReference[0];
                const value = item.value?.[0]?.stringValue?.[0] || "";
                plantumlOutput.push(`    ${ref} = \"${value}\";`);
            });
        });
    }

    // Menangani decision (switch case)
    if (root.decisions) {
        root.decisions.forEach(decision => {
            const label = decision.label[0];
            plantumlOutput.push(`switch (${label})`);
            decision.rules.forEach(rule => {
                const ruleLabel = rule.label[0];
                plantumlOutput.push(`    case (${ruleLabel})`);
            });
        });
    }

    plantumlOutput.push("@enduml");
    return plantumlOutput.join("\n");
}

async function convertXmlToMd(inputXml, outputMd) {
    const plantumlCode = await parseSalesforceXml(inputXml);
    fs.writeFileSync(outputMd, plantumlCode, 'utf-8');
    console.log(`File berhasil dikonversi ke ${outputMd}`);
}

// Contoh penggunaan
convertXmlToMd("Apate.flow-meta.xml", "Apate.md");
