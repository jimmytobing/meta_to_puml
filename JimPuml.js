const fs = require('fs').promises;
const { streetviewpublish } = require('googleapis/build/src/apis/streetviewpublish');
const xml2js = require('xml2js');

async function parseSfMeta(xmlData) {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlData);
    return result;
}

// main dengan fungsi async
async function main(xmlFilePath, outputJson, outputPuml) {
    try {
        const xmlData = await fs.readFile(xmlFilePath, 'utf-8');  //baca file
        const jsonData = await parseSfMeta(xmlData); //convert to json
        const flow = jsonData.Flow; // ambil root Flow

        //Buat file JSON
        //const jsonString = JSON.stringify(flow, null, '\t');
        //fs.writeFile(outputJson, jsonString);
        //console.log(`Json berhasil dibuat: ${outputJson}`);

        //Buat file PUML
        const strPuml = generatePUML(flow);
        //console.log(`PUML: \n${strPuml}`);
        fs.writeFile(outputPuml, strPuml);
        console.log(`Puml berhasil dibuat: ${outputPuml}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

//----------------------------------------------------------------------------------

let objElements = {};
let arrPuml = pumlStart();

function generatePUML(objFlow){
    let retval = ''; 

    //ekstrak object yang punya Name
    findElementsWithName(objFlow);
    objElements['start'] = { type: 'start', data:objFlow['start']  };
    Object.entries(objElements).forEach(([strKey, objValue]) => {
        console.log(`Debug: ${strKey} (Type: ${objValue.type})`);
    });   

    //proses sesuai alur
    let strNext = 'start';
    while(strNext){
        strNext = generatePumlLine(strNext);
    }

    //Object.keys(objFlow).forEach(key => {retval += `${key} |`;});
    arrPuml.push("stop", "@enduml");
    retval = arrPuml.join('\n');
    return retval;
}

function generatePumlLine(strNext){
    let objCur = objElements[strNext];
    let strBefore = strNext;
    
    if(objCur.type==='decisions'){
        arrPuml.push(`switch (${strBefore})`);
        strNext = objCur.data.defaultConnector?.targetReference;

        //recursive
        arrRules = Array.isArray(objCur.data.rules)? objCur.data.rules : [objCur.data.rules];
        arrRules.forEach(rule => {
            arrPuml.push(`case (${rule.name})`);
            let strNext2 = rule.name;
            while(strNext2){
                strNext2 = generatePumlLine(strNext2);
            }
        });

        //default decision
            arrPuml.push(`case (${objCur.data.defaultConnectorLabel})`);
            let strNext3 = objCur.data.defaultConnectorLabel;
            let strNext4 = objCur.data.defaultConnector.targetReference;
            objElements[strNext3] = {name:strNext3, type: 'rules', data: {connector:{targetReference:strNext4}} };
            objElements[strBefore] = null;
            while(strNext3){
                strNext3 = generatePumlLine(strNext3);
            }

        arrPuml.push(`endswitch`);
    }else{
        arrPuml.push(`:${strBefore}(${objCur.type})  --> ${objCur.next};`);
        strNext = objCur.data.connector?.targetReference;
    }

    if(objCur['next']){
        console.log(`Sudah ada ${objCur['next']}`);
    }else{
        objCur['next'] = (strNext)?strNext:'end';
    }
    //console.log(`processed: ${strBefore}(${objCur.type}) --> ${objCur.next}`);
    return strNext;
}

function findElementsWithName(objData, strParentKey = '') {
    if (objData && typeof objData === 'object') {
        if (objData.name) {
            objElements[objData.name] = {name:objData.name, type: strParentKey, data: objData };
        }
        Object.entries(objData).forEach(([strKey, objValue]) => {
            // Jika objValue adalah array atau object, lanjutkan rekursi dengan strKey sebagai strParentKey
            if (Array.isArray(objValue)) {
                objValue.forEach(objItem => findElementsWithName(objItem, strKey));
            } else if (typeof objValue === 'object') {
                findElementsWithName(objValue, strKey);
            }
        });
    }
}


  


function pumlStart(){
    const arrPuml = [
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
        'skinparam defaultFontName "verdana"',
        "start"
    ];

    return arrPuml;
}

// Panggil Main
const xmlFilePath = 'Apate.flow-meta.xml';
const outputJson = 'Apate.flow-meta.json';
const outputPuml = 'Apate.flow-meta.puml';
main(xmlFilePath, outputJson, outputPuml); //panggil async main
