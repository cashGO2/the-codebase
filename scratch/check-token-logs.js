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
            const logs = await col.find({
                method: { $in: ['POST-TOKEN-PROXY', 'POST-TOKEN-PROXY-ERROR'] }
            }).sort({ timestamp: -1 }).limit(10).toArray();
            
            console.log(`Found ${logs.length} token proxy logs:`);
            console.log(JSON.stringify(logs, null, 2));
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
