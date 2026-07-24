import https from 'node:https';

function resolveDnsOverHttps(name, type) {
  return new Promise((resolve) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on("error", () => {
      resolve(null);
    });
  });
}

async function convertSrvToStandardUri(srvUri) {
  if (!srvUri.startsWith("mongodb+srv://")) {
    return srvUri;
  }

  try {
    const schemaIdx = srvUri.indexOf("://");
    const rest = srvUri.substring(schemaIdx + 3);
    
    let creds = "";
    let hostAndPath = rest;
    
    if (rest.includes("@")) {
      const lastAtIdx = rest.lastIndexOf("@");
      creds = rest.substring(0, lastAtIdx);
      hostAndPath = rest.substring(lastAtIdx + 1);
    }
    
    const pathParts = hostAndPath.split("/");
    const rootHostWithQuery = pathParts[0];
    const pathAndQuery = pathParts.slice(1).join("/");
    
    const rootHost = rootHostWithQuery.split("?")[0];
    
    // Query Google DNS over HTTPS for SRV and TXT
    const srvName = `_mongodb._tcp.${rootHost}`;
    const [srvRes, txtRes] = await Promise.all([
      resolveDnsOverHttps(srvName, "SRV"),
      resolveDnsOverHttps(rootHost, "TXT")
    ]);
    
    if (!srvRes || !srvRes.Answer || srvRes.Answer.length === 0) {
      return srvUri; // Fallback to original if DNS fails
    }
    
    // Parse shard hosts and ports
    const shards = srvRes.Answer.map(ans => {
      const parts = ans.data.trim().split(/\s+/);
      const port = parts[2];
      let target = parts[3];
      if (target.endsWith(".")) {
        target = target.slice(0, -1);
      }
      return `${target}:${port}`;
    });
    
    // Parse replicaSet and authSource from TXT
    let txtQuery = "";
    if (txtRes && txtRes.Answer && txtRes.Answer.length > 0) {
      const txtRecord = txtRes.Answer.find(ans => ans.data.includes("replicaSet"));
      if (txtRecord) {
        txtQuery = txtRecord.data.replace(/["']/g, "");
      }
    }
    
    // Reconstruct connection URL
    let newUrl = "mongodb://";
    if (creds) {
      newUrl += creds + "@";
    }
    newUrl += shards.join(",");
    
    // Build query params
    const existingParamsStart = pathAndQuery.indexOf("?");
    let dbPath = existingParamsStart !== -1 ? pathAndQuery.substring(0, existingParamsStart) : pathAndQuery;
    let existingQuery = existingParamsStart !== -1 ? pathAndQuery.substring(existingParamsStart + 1) : "";
    
    // Clean up dbPath
    dbPath = dbPath.replace(/^\/+|\/+$/g, "");
    
    let finalQueryString = "";
    const queryParts = [];
    if (txtQuery) {
      queryParts.push(txtQuery);
    }
    if (existingQuery) {
      queryParts.push(existingQuery);
    }
    
    if (!txtQuery.includes("ssl=") && !existingQuery.includes("ssl=")) {
      queryParts.push("ssl=true");
    }
    
    finalQueryString = queryParts.join("&");
    
    newUrl += `/${dbPath}`;
    if (finalQueryString) {
      newUrl += `?${finalQueryString}`;
    }
    
    return newUrl;
  } catch (err) {
    console.warn("⚠️ Failed to auto-resolve srv URI:", err.message);
    return srvUri;
  }
}

async function test() {
  let url = "";
  try {
    const configPath = path.join(process.cwd(), ".vexora_config", "db_config.json");
    if (fs.existsSync(configPath)) {
      const dbConfigs = JSON.parse(fs.readFileSync(configPath, "utf8"));
      url = dbConfigs.mongodb?.DB_URL || dbConfigs.mongodb?.url || "";
    }
  } catch (e) {
    url = "";
  }

  if (!url) {
    console.log("⚠️ No MongoDB URL found in .vexora_config/db_config.json");
    return;
  }

  console.log('Original from db_config.json:', url);
  const result = await convertSrvToStandardUri(url);
  console.log('Converted:', result);
}

test();
