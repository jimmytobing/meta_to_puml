const fs = require('fs').promises;
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
        const jsonString = JSON.stringify(flow, null, '\t');
        fs.writeFile(outputJson, jsonString);
        console.log(`Json berhasil dibuat: ${outputJson}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

// Panggil Main
const xmlFilePath = 'Apate.flow-meta.xml';
const outputJson = 'Apate.flow-meta.json';
const outputPuml = 'Apate.flow-meta.puml';
main(xmlFilePath, outputJson, outputPuml); //panggil async main
