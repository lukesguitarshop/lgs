// MongoDB script to mirror production data to dev database
// Run with: mongosh "mongodb+srv://lukeydude17:PASSWORD@lukesguitarshop.dode96j.mongodb.net" --file mirror-prod-to-dev.js

const prodDb = db.getSiblingDB('GuitarDb');
const devDb = db.getSiblingDB('GuitarDb_Dev');

// Get all collections from production
const collections = prodDb.getCollectionNames();

print(`Found ${collections.length} collections to mirror:`);
print(collections.join(', '));
print('');

collections.forEach(collName => {
    print(`Mirroring collection: ${collName}`);

    // Drop existing collection in dev (if exists)
    devDb[collName].drop();

    // Get all documents from prod
    const docs = prodDb[collName].find().toArray();

    if (docs.length > 0) {
        // Insert into dev
        devDb[collName].insertMany(docs);
        print(`  Copied ${docs.length} documents`);
    } else {
        print(`  Collection is empty, skipping`);
    }
});

print('');
print('Data mirroring complete!');
print(`Dev database now has ${devDb.getCollectionNames().length} collections`);
