const { MongoClient } = require('mongodb');

const uri = "mongodb://jinansh:admin132@ac-jaumvc2-shard-00-00.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-01.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-02.ckjs3v9.mongodb.net:27017/?ssl=true&replicaSet=atlas-toptzf-shard-0&authSource=admin";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    for (const database of dbsList.databases) {
        const dbInstance = client.db(database.name);
        const collections = await dbInstance.listCollections().toArray();
        if (collections.map(c => c.name).includes('mcp_debug_logs')) {
            const col = dbInstance.collection('mcp_debug_logs');
            const logs = await col.find({}).sort({ timestamp: -1 }).limit(30).toArray();
            console.log(`--- LATEST 30 LOGS FROM ${database.name}.mcp_debug_logs ---`);
            logs.forEach(log => {
                console.log(`[${log.timestamp.toISOString()}] ${log.method} ${log.url}`);
                if (log.headers) {
                    console.log("  Headers:", JSON.stringify(log.headers));
                }
                if (log.body) {
                    console.log("  Body:", JSON.stringify(log.body));
                }
            });
            break;
        }
    }
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.close();
  }
}

main();
