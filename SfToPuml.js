const fs = require('fs').promises;
const xml2js = require('xml2js');

// OK : Variabel dan koneksi
const variables = {};
const elements = {};
const connections = {};
const plantuml = [
    "@startuml",
    "<style>",
    "    element {",
    "        MinimumWidth 100",
    "        MaximumWidth 180",
    "    }",
    "    .kondisi {",
    "        FontSize 9",
    "        Padding 5",
    "        LineStyle 2",
    "        BackGroundColor transparent",
    "        HorizontalAlignment center",
    "    }",
    "</style>",
    'skinparam defaultFontName "verdana"'
];

async function parseSalesforceFlow(xmlFile) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const xmlData = await fs.readFile(xmlFile, 'utf-8'); // Menggunakan fs.promises.readFile

    const result = await parser.parseStringPromise(xmlData);
    const flow = result.Flow;
    return flow;
}

function proses(flow){
    // OK : Ekstrak variabel
    if (flow.variables) {
        const vars = Array.isArray(flow.variables) ? flow.variables : [flow.variables];
        vars.forEach(v => {
            variables[v.name] = {
                type: v.dataType,
                input: v.isInput === 'true',
                output: v.isOutput === 'true',
                value: v.value?.stringValue || null
            };
        });
    }

    //OK: Ekstrak semua elemen dan koneksi
    Object.keys(flow).forEach(key => {
        if (key.endsWith('assignments') || key.endsWith('decisions') || key.endsWith('loops') || key.endsWith('recordLookups') || key.endsWith('recordUpdates') || key.endsWith('recordCreates')) {
            const elemList = Array.isArray(flow[key]) ? flow[key] : [flow[key]];
            elemList.forEach(elem => {

                // Simpan elements
                const name = elem.name;
                elements[name] = { type: key, data: elem };

                // Simpan koneksi
                if(key.endsWith('decisions')){

                    // Default
                    if (elem.defaultConnector?.targetReference) {
                        connections[name+'.'+elem.defaultConnectorLabel] = elem.defaultConnector.targetReference;
                    }else{
                        connections[name+'.'+elem.defaultConnectorLabel] = 'end';
                    }

                    // Branch
                    const lstRules = Array.isArray(elem.rules) ? elem.rules : [elem.rules];
                    lstRules.forEach(r => {
                        if (r.connector?.targetReference) {
                            //connections[name] = r.name;
                            connections[name+'.'+r.name] = r.connector.targetReference;
                        }else{
                            connections[name+'.'+r.name] = 'end';
                        }
                    });

                }else if(key.endsWith('decisions')){
                    
                }else if (elem.connector?.targetReference) {
                    connections[name] = elem.connector.targetReference;
                }else {
                    connections[name] = 'end';
                }

            });
        } else if (key === 'start') {
            connections['start'] = flow.start.connector.targetReference;
        }
    });

    //--------------------- CREATE PUML ----------------------------------------

    // 01.Start
    plantuml.push("start");

    // 02.Tambahkan input variable ke puml
    const inputVar = Object.keys(variables).find(k => variables[k].input);
    if (inputVar) {
        plantuml.push(`\t:${inputVar} = "${variables[inputVar].value}";<<input>>`);
    }

    // 03.Proses alur utama
    let current = connections['start'];
    let tab = prosesAlurUtama(current,1);

    // 04.Tambahkan output variable ke puml
    const outputVar = Object.keys(variables).find(k => variables[k].output);
    if (outputVar) {
        plantuml.push(`\t:${outputVar};<<output>>`);
    }

    // 05.Stop
    plantuml.push("stop", "@enduml");
    return plantuml.join('\n');
}

function prosesAlurUtama(current, lvl) {
    let tab = '\t'.repeat(lvl);
    let tabtab = '\t'.repeat(lvl + 1);
    while (current) {
        const elem = elements[current];
        if (!elem) break;

        // 01.Record Lookup
        if (elem.type === 'recordLookups') {
            const obj = elem.data.object;
            const filters = [];
            if (elem.data.filters) {
                const filterList = Array.isArray(elem.data.filters) ? elem.data.filters : [elem.data.filters];
                filterList.forEach(f => {
                    filters.push(`${f.field} ${f.operator} ${f.value.elementReference}`);
                });
            }

            const query = `select ${elem.data.getFirstRecordOnly === 'true' ? 'top1 ' : '* '}from ${obj}`;
            if (filters.length > 0) {
                plantuml.push(`\n${tab}:${current} \n${tab}----\n${tab}${query}\n${tab}where ${filters.join(' AND ')};`);
            } else {
                plantuml.push(`\n${tab}:${current} \n${tab}----\n${tab}${query};`);
            }
            current = connections[current];
        }

        // Decision
        else if (elem.type === 'decisions') {
            plantuml.push(`\n${tab}switch (${elem.data.label})`);
            const rules = Array.isArray(elem.data.rules) ? elem.data.rules : [elem.data.rules];
            rules.forEach(rule => {
                const condition = rule.conditions;
                const left = condition.leftValueReference;
                const op = condition.operator;
                const right = condition.rightValue.numberValue;
                plantuml.push(`${tab}case ()`);
                plantuml.push(`${tabtab}:${rule.label}\n${tabtab}....\n${tabtab}${left} ${op} ${right};<<kondisi>>`);

                // Process the connector within the case
                let caseCurrent = rule.connector.targetReference;
                while (caseCurrent) {
                    const caseElem = elements[caseCurrent];
                    if (!caseElem) break;

                    // Record Lookup within the case
                    if (caseElem.type === 'recordLookups') {
                        const obj = caseElem.data.object;
                        const filters = [];
                        if (caseElem.data.filters) {
                            const filterList = Array.isArray(caseElem.data.filters) ? caseElem.data.filters : [caseElem.data.filters];
                            filterList.forEach(f => {
                                filters.push(`${f.field} ${f.operator} ${f.value.elementReference}`);
                            });
                        }

                        const query = `select ${caseElem.data.getFirstRecordOnly === 'true' ? 'top1 ' : '* '}from ${obj}`;
                        if (filters.length > 0) {
                            plantuml.push(`${tabtab}:${caseCurrent} \n${tabtab}----\n${tabtab}${query}\n${tabtab}where ${filters.join(' AND ')};`);
                        } else {
                            plantuml.push(`${tabtab}:${caseCurrent} \n${tabtab}----\n${tabtab}${query};`);
                        }
                        caseCurrent = connections[caseCurrent];
                    }

                    // Loop within the case
                    else if (caseElem.type === 'loops') {
                        const collection = caseElem.data.collectionReference;
                        plantuml.push(`\n${tabtab}while(${caseCurrent} : ${collection})`);
                        plantuml.push(`${tabtab.repeat(2)}:${caseElem.data.nextValueConnector.targetReference};`);
                        plantuml.push(`${tabtab}endwhile`);
                        caseCurrent = connections[caseCurrent];
                    }

                    // Assignment within the case
                    else if (caseElem.type === 'assignments') {
                        const assignment = caseElem.data.assignmentItems;
                        const varName = assignment.assignToReference;
                        const value = assignment.value.stringValue || assignment.value.booleanValue;
                        plantuml.push(`${tabtab}:${varName} = "${value}";`);
                        caseCurrent = connections[caseCurrent];
                    }
                }
            });

            // Default case
            const defaultConnector = elem.data.defaultConnector.targetReference;
            plantuml.push(`${tab}case ()`);
            plantuml.push(`${tabtab}:NULL;<<kondisi>>`);
            plantuml.push(`${tabtab}:${defaultConnector};`);
            plantuml.push(`${tab}endswitch`);
            current = null; // Sudah dihandle oleh case
        }

        // Loop
        else if (elem.type === 'loops') {
            const collection = elem.data.collectionReference;
            plantuml.push(`\n${tab}while(${current} : ${collection})`);
            plantuml.push(`${tabtab}:${elem.data.nextValueConnector.targetReference};`);
            plantuml.push(`${tab}endwhile`);
            current = connections[current];
        }

        // Record Update/Create
        else if (elem.type === 'recordUpdates' || elem.type === 'recordCreates') {
            const obj = elem.data.object;
            const action = elem.type === 'recordUpdates' ? 'Update' : 'Upsert';
            const inputs = [];
            if (elem.data.inputAssignments) {
                const inputList = Array.isArray(elem.data.inputAssignments) ? elem.data.inputAssignments : [elem.data.inputAssignments];
                inputList.forEach(ia => {
                    const value = ia.value.stringValue || ia.value.elementReference;
                    inputs.push(`${ia.field} = ${value}`);
                });
            }

            // Filter untuk update
            const filters = [];
            if (elem.data.filters) {
                const filterList = Array.isArray(elem.data.filters) ? elem.data.filters : [elem.data.filters];
                filterList.forEach(f => {
                    filters.push(`${f.field} = ${f.value.elementReference}`);
                });
            }

            if (action === 'Upsert') {
                const conflictField = elem.data.filters.field;
                const conflictValue = elem.data.filters.stringValue;
                plantuml.push(`:${action} ${obj} \n----\nSet ${inputs.join(', ')}\non conflict (${conflictField}) = "${conflictValue}";`);
            } else {
                plantuml.push(`:${action} ${obj} \n----\nSet ${inputs.join(', ')}` + 
                               (filters.length > 0 ? `\nwhere ${filters.join(' AND ')}` : '') + ';');
            }
            current = connections[current];
        }

        // Assignment
        else if (elem.type === 'assignments') {
            const assignment = elem.data.assignmentItems;
            const varName = assignment.assignToReference;
            const value = assignment.value.stringValue || assignment.value.booleanValue;
            plantuml.push(`${tab}:${varName} = "${value}";`);
            current = connections[current];
        }
    }

    return lvl;
}

// main dengan fungsi async
async function main(xmlFilePath, outputFile) {
    try {
        const flow = await parseSalesforceFlow(xmlFilePath);
        const plantumlCode = proses(flow);
        fs.writeFile(outputFile, plantumlCode);
        console.log(`PlantUML berhasil dibuat: ${outputFile}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

// Contoh penggunaan
const xmlFilePath = 'Gen_Python.flow-meta.xml';
const outputFile = 'Gen_Python.flow-meta.puml';
main(xmlFilePath, outputFile); //panggil async main
