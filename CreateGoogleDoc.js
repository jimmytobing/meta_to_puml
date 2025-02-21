const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load kredensial dari file JSON yang diunduh dari Google Cloud Console
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

// Scopes yang diperlukan untuk mengakses Google Docs API
const SCOPES = ['https://www.googleapis.com/auth/documents'];

// Fungsi untuk mengautentikasi dan menginisialisasi Google Docs API
async function authorize() {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Cek apakah sudah ada token yang disimpan
  const TOKEN_PATH = path.join(__dirname, 'token.json');
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  }

  // Jika belum ada token, minta pengguna untuk mengautentikasi
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const code = await new Promise((resolve) => {
    process.stdin.once('data', (data) => resolve(data.toString().trim()));
  });
  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  return oAuth2Client;
}

// Fungsi untuk membuat dokumen baru
async function createDocument(auth) {
  const docs = google.docs({ version: 'v1', auth });

  const document = await docs.documents.create({
    title: 'Jalan-jalan ke danau toba',
  });

  const documentId = document.data.documentId;

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: {
              index: 1,
            },
            text: 'Jalan-jalan ke danau toba\n',
          },
        },
        {
          updateParagraphStyle: {
            range: {
              startIndex: 1,
              endIndex: 24,
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_1',
              alignment: 'CENTER',
            },
            fields: 'namedStyleType,alignment',
          },
        },
        {
          insertText: {
            location: {
              index: 25,
            },
            text: '1.Parapat\n',
          },
        },
        {
          updateParagraphStyle: {
            range: {
              startIndex: 25,
              endIndex: 35,
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_2',
            },
            fields: 'namedStyleType',
          },
        },
        {
          insertText: {
            location: {
              index: 35,
            },
            text: 'Selamat datang ke Parapat\n',
          },
        },
        {
          insertText: {
            location: {
              index: 60,
            },
            text: '2.Tomok\n',
          },
        },
        {
          updateParagraphStyle: {
            range: {
              startIndex: 60,
              endIndex: 68,
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_2',
            },
            fields: 'namedStyleType',
          },
        },
        {
          insertText: {
            location: {
              index: 68,
            },
            text: 'Selamat datang ke Tomok, setelah perjalanan dari parapat\n',
          },
        },
      ],
    },
  });

  console.log(`Dokumen berhasil dibuat: https://docs.google.com/document/d/${documentId}`);
}

// Jalankan fungsi authorize dan createDocument
authorize().then(createDocument).catch(console.error);