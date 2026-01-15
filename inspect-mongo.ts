
import mongoose from "mongoose";
import "dotenv/config";
import { User, VaultBlob, SimpleVault } from "./packages/backend/src/database/models.js";

async function inspectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("\n--- Inspecting MongoDB Atlas ---\n");

  const users = await User.find();
  console.log(`>> Found ${users.length} Users:`);
  users.forEach(u => {
    console.log(`   - Email: ${u.email}`);
    console.log(`   - ID: ${u._id}`);
  });

  const blobs = await VaultBlob.find();
  console.log(`\n>> Found ${blobs.length} Dashboard Sync Blobs:`);
  blobs.forEach(b => {
    console.log(`   - UserID: ${b.userId}`);
  });

  const simpleVaults = await SimpleVault.find();
  console.log(`\n>> Found ${simpleVaults.length} Extension Sync Vaults:`);
  simpleVaults.forEach(sv => {
    console.log(`   - UserID: ${sv.userId}`);
    console.log(`   - Data: ${JSON.stringify(sv.data).substring(0, 100)}... [ENCRYPTED GIBBERISH]`);
  });

  console.log("\n--- Inspection Complete ---");
  await mongoose.connection.close();
}

inspectMongo();
