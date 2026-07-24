import https from 'node:https';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const srvUrl = 'https://dns.google/resolve?name=_mongodb._tcp.cluster0.rfxy4fw.mongodb.net&type=SRV';
  const txtUrl = 'https://dns.google/resolve?name=cluster0.rfxy4fw.mongodb.net&type=TXT';
  
  try {
    const srvRes = await fetchJson(srvUrl);
    console.log('SRV Result:', JSON.stringify(srvRes, null, 2));
    
    const txtRes = await fetchJson(txtUrl);
    console.log('TXT Result:', JSON.stringify(txtRes, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
