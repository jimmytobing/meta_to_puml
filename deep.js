const fs = require('fs').promises;
const { parseString } = require('xml2js');

async function xmlToPlantUML(strXmlPath, strOutputPath) {
    const strXmlContent = await fs.readFile(strXmlPath, 'utf-8');
    const objFlow = await parseXml(strXmlContent);
    
    let strUml = '@startuml\n<style>\n    element {\n        MinimumWidth 100\n        MaximumWidth 200\n    }\n    .kondisi {\n        FontSize 9\n        Padding 5\n        LineStyle 2\n        BackGroundColor transparent\n        HorizontalAlignment center\n    }\n</style>\nskinparam defaultFontName "verdana"\n\n';
    
    strUml += 'start\n';
    
    // Handle variables and initial steps
    strUml += `:recordId_Acc = "${objFlow.variables[0].value[0].stringValue[0]}"\n`;
    strUml += `varS_Input = "Input Baru";<<input>>\n\n`;

    // Process flow elements
    for (const el of objFlow.recordLookups) {
        strUml += `:${el.$.name} \n----\nselect ${el.getFirstRecordOnly[0] === 'true' ? 'top1' : '*'} from ${el.object[0]}\nwhere `;
        strUml += el.filters.map(f => `${f.field[0]} ${f.operator[0]} ${f.value[0][Object.keys(f.value[0])[0]}`).join('\nand ');
        strUml += ';\n\n';
    }

    // Handle decisions
    for (const decision of objFlow.decisions) {
        strUml += `switch (${decision.$.label})\n`;
        for (const rule of decision.rules) {
            strUml += `case (${rule.label[0]})\n`;
            strUml += `:${rule.label[0]}\n....\n`;
            strUml += rule.conditions.map(c => `${c.leftValueReference[0]} ${c.operator[0]} ${c.rightValue[0][Object.keys(c.rightValue[0])[0]}`).join('\nand ');
            strUml += ';<<kondisi>>\n\n';
        }
        strUml += `endswitch\n\n`;
    }

    // Handle transforms (Amount calculations)
    for (const transform of objFlow.transforms) {
        strUml += `:${transform.$.label}\n----\nselect Sum(${transform.transformValues[0].transformValueActions[0].inputParameters[1].value[0].stringValue[0]})\nfrom rst_Opty;\n\n`;
    }

    // Handle loops
    const objLoop = objFlow.loops[0];
    strUml += `while(${objLoop.$.name} : ${objLoop.collectionReference[0]})\n    :${objLoop.$.name}.IsPriorityRecord = True;\nendwhile\n\n`;

    // Handle updates and upserts
    strUml += ':Update Contact \n----\nrst_Contact;\n\n';
    strUml += ':Update Account \n----\nSet Rating = varS_Rating,\nBillingCity = "Medan"\nwhere Id = recordId_Acc;\n\n';
    strUml += ':Upsert Account \n----\nSet Name = "Jimmy",\nType = cur_Acc.Type\non conflict (Name) = "Jimmy";\n\n';

    strUml += ':varS_Rating\nvarS_Output;<<output>>\nstop\n@enduml';
    
    await fs.writeFile(strOutputPath, strUml);
}

async function parseXml(strXml) {
    return new Promise((resolve, reject) => {
        parseString(strXml, { explicitArray: false }, (err, result) => {
            if (err) reject(err);
            else resolve(result.Flow);
        });
    });
}

// Contoh penggunaan
xmlToPlantUML('Apate.flow-meta.xml', 'Apate.md').catch(console.error);
