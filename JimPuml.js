const fs = require('fs').promises;
const { equal } = require('assert');
const { streetviewpublish } = require('googleapis/build/src/apis/streetviewpublish');
const xml2js = require('xml2js');

const opr ={
    EqualTo : "=",
    IsNull : "null",
    GreaterThan : ">",
    GreaterThanEqual : ">=",
    LessThan : "<",
    LessThanEqual : "<="
}

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
    objElements['start'] = {type:'start', next: null, data: objFlow['start']};
    findElementsWithName(objFlow,'');
    Object.entries(objElements).forEach(([strKey, objValue]) => {
        console.log(`Debug: ${strKey} (Type: ${objValue.type})`);
        const strNext = cariNext(objValue.type, objValue.data);
        objValue.next = strNext;
    });

    let arrInput = [];
    let arrOutput = [];
    // 01.Tambahkan input variable ke puml 
    Object.keys(objElements).forEach(k=>{
        const elem = objElements[k];
        if(elem.type==='variables'){
            const ed = elem.data;
            if(ed.isInput==='true'){
                const value = ed.value.stringValue || ed.value.booleanValue;
                arrInput.push(`:${ed.name} = "${value}";<<input>>`);
            }

            else if(ed.isOutput==='true'){
                arrOutput.push(`:${ed.name};<<output>>`);
            }
        }
    });

    // 02.Proses sesuai alur
    let arrAlur = [];
    let strKey = 'start';
    while(strKey){
        arrAlur.push(generatePumlLine(strKey));
        strKey = objElements[strKey].next;
    }

    let arrPuml = pumlStart();
    arrPuml = [...arrPuml,...arrInput,...arrAlur,...arrOutput];
    arrPuml.push("stop", "@enduml");
    retval = arrPuml.join('\n');
    return retval;
}

function generatePumlLine(strKey){
    let retval = '';
    const objCur = objElements[strKey];

    // 00.start
    if(objCur.type === 'start'){
        return '';
    }
    
    // 01.decisions
    else if(objCur.type === 'decisions'){
        retval = pumlDecisions(objCur);
    }

    // 02.loops
    else if(objCur.type === 'loops'){
        retval = pumlLoops(objCur);
    }

    // 03.recordLookups
    else if (objCur.type === 'recordLookups') {
        retval = pumlRecLookups(objCur);
    }

    //  04.recordUpdates
    else if (objCur.type === 'recordUpdates') {
        retval = pumlRecUpdates(objCur);
    }

    //  05.recordCreates
    else if (objCur.type === 'recordCreates') {
        retval = pumlRecCreates(objCur);
    }

    // 06.rules
    else if (objCur.type === 'rules') {
        retval = pumlRules(objCur);
    }

    // 07.assignments
    else if (objCur.type === 'assignments') {
        retval = pumlAssignments(objCur);
    }
    
    // 99.other
    else{
        retval = `:${strKey}(${objCur.type})  --> ${objCur.next};`;
        if(objCur.type==='rules') retval += '<<kondisi>>';
    }
    
    return retval;
}

function pumlRules(objCur){
    const plantuml = [];
    const rule = objCur.data;
    const arrCond = Array.isArray(rule.conditions)? rule.conditions:[rule.conditions];
    arrCond.forEach(condition =>{
        const left = condition.leftValueReference;
        const op = opr[condition.operator];
        const right = condition.rightValue.numberValue || condition.rightValue.booleanValue || condition.rightValue.stringValue;
        plantuml.push(`${left} ${op} ${right}`);
    });
    //-------------------------------------
    const retval = `:${rule.label}\n....\n${plantuml.join('\n')};<<kondisi>>`;
    return retval;
}

function pumlAssignments(objCur){
    const plantuml = [];
    const elem = objCur;
    const arrAssignment = Array.isArray(elem.data.assignmentItems)? elem.data.assignmentItems : [elem.data.assignmentItems];

    arrAssignment.forEach(assignment => {
        const varName = assignment.assignToReference;
        const value = assignment.value.stringValue || assignment.value.booleanValue;
        plantuml.push(`:${varName} = "${value}";`);
    });

    //-------------------------------------
    const retval = plantuml.join('\n');
    return retval;
}

function pumlRecCreates(objCur){
    const plantuml = [];
    const elem = objCur;
    const obj = elem.data.object;
    const action = (elem.data.filters.field) ? 'Upsert' : 'Create';
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
        plantuml.push(`:Upsert ${obj} \n----\nSet ${inputs.join(',\n')}\n----\non conflict (${conflictField});`);
    } else {
        plantuml.push(`:Create ${obj} \n----\nValues( ${inputs.join(',\n')} );` );
    }
    //-------------------------------------
    const retval = plantuml.join('\n');
    return retval;
}

function pumlRecUpdates(objCur){
    const plantuml = [];
    const elem = objCur;
    const obj = elem.data.object;
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
            filters.push(`\n${f.field} = ${f.value.elementReference}`);
        });
    }

    if(elem.data.inputReference) {
        plantuml.push(`:Update \n----\n${elem.data.inputReference};`);
    }else{
        plantuml.push(`:Update ${obj} \n----\nSet ${inputs.join(', ')}` + 
                        (filters.length > 0 ? `\nwhere ${filters.join(' AND ')}` : '') + ';');
    }
    //-------------------------------------
    const retval = plantuml.join('\n');
    return retval;
}

function pumlRecLookups(objCur){
    const elem = objCur.data;
    const current = objCur.name;
    const plantuml = [];
    const filters = [];
    //-------------------------------------
    if (elem.filters) {
        const filterList = Array.isArray(elem.filters) ? elem.filters : [elem.filters];
        filterList.forEach(f => {
            const value = f.value.elementReference || f.value.booleanValue;
            filters.push(`${f.field} ${opr[f.operator]} ${value}`);
        });
    }
    //-------------------------------------
    const query = `select ${elem.getFirstRecordOnly === 'true' ? 'top1' : '*'} from ${elem.object}`;
    if (filters.length > 0) {
        plantuml.push(`:${current} \n----\n${query} \nwhere ${filters.join('\nAND ')};`); //jim perbaiki
    } else {
        plantuml.push(`:${current} \n----\n${query};`);
    }
    //-------------------------------------
    const retval = plantuml.join('\n');
    return retval;
}

function pumlLoops(objCur){
    const elem = objCur.data;
    const collection = elem.collectionReference;
    const arrTmp = [];
    //-------------------------------------
    arrTmp.push(`while(${objCur.name} : ${collection})`);
    let strTmp = elem.nextValueConnector.targetReference;
    arrTmp.push(`\t`+generatePumlLine(strTmp));
    arrTmp.push(`endwhile`);
    //-------------------------------------        
    const retval = arrTmp.join('\n');
    return retval;
}

function pumlDecisions(objCur){
    const strKey = objCur.name;
    const arrTmp = [];
    arrTmp.push(`switch (${strKey})`);
        //-------------------------------------
        const arrRules = Array.isArray(objCur.data.rules)? objCur.data.rules : [objCur.data.rules];
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
            arrTmp.push(`case (${objCur.data.defaultConnectorLabel})`);
                let strElse = objCur.data.defaultConnectorLabel;
                let strTmp = objCur.data.defaultConnector.targetReference;
                arrTmp.push(`\t:${strElse};<<kondisi>>`);

            while(strTmp!==objCur.next){
                const objTmp = objElements[strTmp];
                arrTmp.push(`\t`+generatePumlLine(strTmp));
                strTmp = objTmp.next;
            }
        //-------------------------------------
    arrTmp.push(`endswitch`);
    const retval = arrTmp.join('\n');
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
            const objData = objElements[strNext].data;
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
            objElements[objData.name] = {name:objData.name, type: strParentKey, next: null, data: objData };
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
    else if(strParentKey==='loops'){
        strNext = (strNext)? strNext : objData.noMoreValuesConnector?.targetReference; 
    }

    // 99.start, assignments, recordLookups, recordUpdates, transforms, rules
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
