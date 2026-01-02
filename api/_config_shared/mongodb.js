// MongoDB configuration for Materio dynamic forms
const { MongoClient } = require('mongodb');
require('dotenv').config();

let mongoClient = null;
let db = null;

/**
 * Get MongoDB database instance with connection pooling
 * @returns {Promise<import('mongodb').Db>}
 */
async function getMongoDb() {
    if (db) {
        return db;
    }

    const MONGODB_URI = process.env.MONGODB_URI;

    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
    }

    try {
        console.log('Connecting to MongoDB...');
        mongoClient = new MongoClient(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
        });

        await mongoClient.connect();
        db = mongoClient.db('materio');

        console.log('MongoDB connected successfully');
        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        throw error;
    }
}

/**
 * Get the form submissions collection
 * @returns {Promise<import('mongodb').Collection>}
 */
async function getFormsCollection() {
    const database = await getMongoDb();
    return database.collection('form_submissions');
}

/**
 * Get the form configs collection (for admin-editable form configurations)
 * @returns {Promise<import('mongodb').Collection>}
 */
async function getFormConfigsCollection() {
    const database = await getMongoDb();
    return database.collection('form_configs');
}

/**
 * Close MongoDB connection (for cleanup)
 */
async function closeMongoConnection() {
    if (mongoClient) {
        await mongoClient.close();
        mongoClient = null;
        db = null;
    }
}

module.exports = {
    getMongoDb,
    getFormsCollection,
    getFormConfigsCollection,
    closeMongoConnection
};
