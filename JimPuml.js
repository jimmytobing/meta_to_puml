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

        //Buat file PUML
        const strPuml = generatePUML(flow);
        fs.writeFile(outputPuml, strPuml);
        console.log(`Puml berhasil dibuat: ${outputPuml}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

//----------------------------------------------------------------------------------

const objElements = {};
function generatePUML(objFlow){
    let retval = ''; 

    //ekstrak object yang punya Name kedalam "objElements"
    objElements['start'] = {type:'start', next: null, zdata: objFlow['start']};
    findElementsWithName(objFlow,'');
    Object.entries(objElements).forEach(([strKey, objValue]) => {
        console.log(`Debug: ${strKey} (Type: ${objValue.type})`);
        const strNext = cariNext(objValue.type, objValue.zdata);
        objValue.next = strNext;
    });


    //proses sesuai alur
    let arrPuml = pumlStart();
    let strKey = 'start';
    while(strKey){
        arrPuml.push(generatePumlLine(strKey));
        strKey = objElements[strKey].next;
    }

    arrPuml.push("stop", "@enduml");
    retval = arrPuml.join('\n');
    return retval;
}

function generatePumlLine(strKey){
    let retval = '';
    const objCur = objElements[strKey];

    // 01.decisions
    if(objCur.type === 'decisions'){
        const arrTmp = [];
        arrTmp.push(`switch (${strKey})`);
            //-------------------------------------
            const arrRules = Array.isArray(objCur.zdata.rules)? objCur.zdata.rules : [objCur.zdata.rules];
            arrRules.forEach(rule => {
                arrTmp.push(`case (${rule.name})`);
                let strTmp = rule.name;
                while(strTmp!==objCur.next){
                    const objTmp = objElements[strTmp];
                    arrTmp.push(`\t`+generatePumlLine(strTmp));
                    strTmp = objTmp.next;
                }
            });
            //-------------------------------------
                arrTmp.push(`case (${objCur.zdata.defaultConnectorLabel})`);
                    let strElse = objCur.zdata.defaultConnectorLabel;
                    let strTmp = objCur.zdata.defaultConnector.targetReference;
                    arrTmp.push(`\t:${strElse}('rules')  --> ${strTmp};<<kondisi>>`);

                while(strTmp!==objCur.next){
                    const objTmp = objElements[strTmp];
                    arrTmp.push(`\t`+generatePumlLine(strTmp));
                    strTmp = objTmp.next;
                }
            //-------------------------------------
        arrTmp.push(`endswitch`);
        retval = arrTmp.join('\n');
    }

    // 02.loop
    else if(objCur.type === 'loop'){
        
    }
    
    // 03.other
    else{
        retval = `:${strKey}(${objCur.type})  --> ${objCur.next};`;
        if(objCur.type==='rules') retval += '<<kondisi>>';
    }
    
    return retval;
}

function findEndIF(arrAnak){
    let retval='';
    const objDone={};
    arrAnak.forEach(anak => {
        let strNext = anak.next;
        while(strNext){
            if(objDone[strNext]) {
                retval = strNext;
                return retval;
            }else{
                objDone[strNext]=true;
            }
            const objData = objElements[strNext].zdata;
            strNext = objData.connector?.targetReference; //normal
            strNext = (strNext)? strNext : objData.noMoreValuesConnector?.targetReference;  // loop
        }

    });
    return retval;
}

function findElementsWithName(objData, strParentKey = '') {
    if(strParentKey.endsWith('processMetadataValues') || strParentKey.endsWith('inputParameters')) return;
    if (objData && typeof objData === 'object') {
        if (objData.name) {
            objElements[objData.name] = {name:objData.name, type: strParentKey, next: null, zdata: objData };
        }
        Object.entries(objData).forEach(([strKey, objValue]) => {

            // Jika objValue adalah array, lanjutkan rekursi dengan strKey sebagai strParentKey
            if (Array.isArray(objValue)) {
                objValue.forEach(objItem => findElementsWithName(objItem, strKey));
            
            // Jika objValue adalah object, lanjutkan rekursi dengan strKey sebagai strParentKey
            } else if (typeof objValue === 'object') {
                findElementsWithName(objValue, strKey);
            }

        });
    }
}

function cariNext(strParentKey,objData){
    let strNext;

    // 01.decisions
    if(strParentKey==='decisions'){
        const arrAnak = [{name : objData.defaultConnectorLabel, next: objData.defaultConnector.targetReference}]; 
        const arrRules = Array.isArray(objData.rules)? objData.rules : [objData.rules];
              arrRules.forEach(rule => {
                arrAnak.push({name:rule.name, next:rule.connector?.targetReference});
              });
        strNext = findEndIF(arrAnak);
    }

    // 02.loop
    else if(strParentKey==='loop'){
        strNext = (strNext)? strNext : objData.noMoreValuesConnector?.targetReference; 
    }

    // 03.start, assignments, recordLookups, recordUpdates, transforms, rules
    else{
        strNext = objData.connector?.targetReference; 
    }

    return strNext;
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
