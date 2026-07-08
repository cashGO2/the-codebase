const { MongoClient } = require('mongodb');
const uri = "mongodb://jinansh:admin132@ac-jaumvc2-shard-00-00.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-01.ckjs3v9.mongodb.net:27017,ac-jaumvc2-shard-00-02.ckjs3v9.mongodb.net:27017/?ssl=true&replicaSet=atlas-toptzf-shard-0&authSource=admin";

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('insightroom');
    const col = db.collection('mcp_debug_logs');
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const logs = await col.find({ timestamp: { $gt: fifteenMinAgo } }).sort({ timestamp: -1 }).toArray();
    console.log(`Found ${logs.length} logs in the last 15 minutes:`);
    logs.forEach(log => {
      console.log(`[${log.timestamp.toISOString()}] ${log.method || 'NO-METHOD'} ${log.url || ''}`);
      if (log.headers) {
        console.log("  Headers:", JSON.stringify(log.headers));
      }
      if (log.body) {
        console.log("  Body:", JSON.stringify(log.body));
      }
      if (log.requestBody) {
        console.log("  RequestBody:", JSON.stringify(log.requestBody));
      }
      if (log.responseBody) {
        console.log("  ResponseBody:", JSON.stringify(log.responseBody));
      }
      if (log.responseStatus) {
        console.log("  ResponseStatus:", log.responseStatus);
      }
      if (log.error) {
        console.log("  Error:", log.error);
      }
    });
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.close();
  }
}

main();
