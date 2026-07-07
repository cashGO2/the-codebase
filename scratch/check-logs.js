const { MongoClient } = require('mongodb');

const uri = "mongodb://jinansh:admin132@ac-jaumvc2-shard-00-00.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-01.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-02.ckjs3v9.mongodb.net:27017/?ssl=true&replicaSet=atlas-toptzf-shard-0&authSource=admin";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const db = client.db("test"); // wait, let's see which db it is. Sveltekit might use a default or specified db.
    // Let's list databases first to find the correct database name
    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    console.log("Databases:", dbsList.databases.map(d => d.name));
    
    // Sveltekit might use 'test' or something else. Let's iterate and try to find the collections.
    for (const database of dbsList.databases) {
        const dbInstance = client.db(database.name);
        const collections = await dbInstance.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        if (collectionNames.includes('mcp_debug_logs')) {
            console.log(`Found mcp_debug_logs in db: ${database.name}`);
            const col = dbInstance.collection('mcp_debug_logs');
            const logs = await col.find({}).sort({ timestamp: -1 }).limit(10).toArray();
            console.log("Latest logs:");
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
