#!/usr/bin/env node
/*
 * One-time migration: take a tarball of the prod Fly machine's /app/wwwroot/uploads/,
 * upload everything to Tigris (S3-compatible), and rewrite MongoDB message records
 * whose `image_urls` still point at the old `${OLD_BASE_URL}/uploads/messages/...` URLs.
 *
 * Usage:
 *   1. fly ssh console -a guitar-price-api -C 'tar czf /tmp/uploads.tar.gz -C /app/wwwroot uploads'
 *      fly sftp shell ... get /tmp/uploads.tar.gz ./prod-uploads-backup.tar.gz
 *   2. Set the env vars listed below.
 *   3. node scripts/migrate-uploads-to-tigris.js [--dry-run]
 *
 * Required env vars:
 *   MONGODB_URI            — MongoDB connection string
 *   MONGODB_DB             — database name (e.g. GuitarDb)
 *   AWS_ENDPOINT_URL_S3    — e.g. https://fly.storage.tigris.dev
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   BUCKET_NAME
 *   TARBALL_PATH           — path to prod-uploads-backup.tar.gz
 *   OLD_BASE_URL           — old API origin, e.g. https://guitar-price-api.fly.dev
 *
 * Optional:
 *   AWS_REGION             — defaults to "auto" (Tigris)
 *   --dry-run              — print actions, do not write
 *
 * Idempotency: re-running is safe. S3 PutObject with the same key overwrites with
 * identical content, and the Mongo update only rewrites URLs that still match the
 * old prefix — already-migrated docs are skipped.
 */

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const mime = require('mime-types');
const { MongoClient } = require('mongodb');
const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

const DRY_RUN = process.argv.includes('--dry-run');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

const MONGODB_URI = requireEnv('MONGODB_URI');
const MONGODB_DB = requireEnv('MONGODB_DB');
const AWS_ENDPOINT_URL_S3 = requireEnv('AWS_ENDPOINT_URL_S3');
const AWS_ACCESS_KEY_ID = requireEnv('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = requireEnv('AWS_SECRET_ACCESS_KEY');
const BUCKET_NAME = requireEnv('BUCKET_NAME');
const TARBALL_PATH = requireEnv('TARBALL_PATH');
const OLD_BASE_URL = requireEnv('OLD_BASE_URL').replace(/\/+$/, '');
const AWS_REGION = process.env.AWS_REGION || 'auto';

const PUBLIC_BASE = `${AWS_ENDPOINT_URL_S3.replace(/\/+$/, '')}/${BUCKET_NAME}`;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function runTar(tarball, destDir) {
  return new Promise((resolve, reject) => {
    // Use system tar (works on Linux/macOS and Windows 10+ which ships bsdtar).
    const child = spawn('tar', ['xzf', tarball, '-C', destDir], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code}`));
    });
  });
}

async function* walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function inferContentType(filePath) {
  return mime.lookup(filePath) || 'application/octet-stream';
}

async function uploadFile(s3, absPath, key) {
  const body = await fsp.readFile(absPath);
  const contentType = inferContentType(absPath);
  if (DRY_RUN) {
    log(`DRY: would upload ${key} (${body.length}B, ${contentType})`);
    return;
  }
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: 'public-read',
  }));
}

async function uploadAll(uploadsRoot, s3) {
  let count = 0;
  let errors = 0;
  for await (const file of walk(uploadsRoot)) {
    // Strip the leading uploadsRoot path so we end up with `messages/abc.jpg` etc.
    const rel = path.relative(uploadsRoot, file).split(path.sep).join('/');
    const key = rel; // already relative to "uploads/", produces e.g. "messages/abc.jpg"
    try {
      await uploadFile(s3, file, key);
      count++;
      if (count % 25 === 0) log(`Uploaded ${count} files...`);
    } catch (err) {
      errors++;
      console.error(`Failed to upload ${key}:`, err.message);
    }
  }
  return { count, errors };
}

async function rewriteMessageUrls(mongo) {
  const db = mongo.db(MONGODB_DB);
  const messages = db.collection('messages');

  const oldPrefix = `${OLD_BASE_URL}/uploads/messages/`;
  // Find docs whose image_urls array contains at least one URL with the old prefix.
  const cursor = messages.find({
    image_urls: { $elemMatch: { $regex: `^${escapeRegex(oldPrefix)}` } },
  });

  let updated = 0;
  let scanned = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned++;
    const before = doc.image_urls || [];
    const after = before.map(url => {
      if (typeof url !== 'string') return url;
      if (!url.startsWith(oldPrefix)) return url;
      const filename = url.slice(oldPrefix.length);
      return `${PUBLIC_BASE}/messages/${filename}`;
    });

    const changed = after.some((v, i) => v !== before[i]);
    if (!changed) continue;

    if (DRY_RUN) {
      log(`DRY: would update message ${doc._id}: ${before.length} URLs`);
      updated++;
      continue;
    }

    await messages.updateOne(
      { _id: doc._id },
      { $set: { image_urls: after } },
    );
    updated++;
  }

  return { scanned, updated };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  log(`Starting migration. dryRun=${DRY_RUN}`);
  log(`Tarball: ${TARBALL_PATH}`);
  log(`Bucket:  ${BUCKET_NAME} @ ${AWS_ENDPOINT_URL_S3}`);
  log(`MongoDB: ${MONGODB_DB} (rewriting URLs starting with ${OLD_BASE_URL}/uploads/messages/)`);

  if (!fs.existsSync(TARBALL_PATH)) {
    console.error(`Tarball not found at ${TARBALL_PATH}`);
    process.exit(1);
  }

  const tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'lgs-uploads-'));
  log(`Extracting tarball to ${tmpRoot}...`);
  try {
    await runTar(TARBALL_PATH, tmpRoot);
  } catch (err) {
    console.error('Failed to extract tarball:', err);
    process.exit(1);
  }

  // Tarball is expected to contain a top-level `uploads/` directory.
  let uploadsRoot = path.join(tmpRoot, 'uploads');
  if (!fs.existsSync(uploadsRoot)) {
    // Fallback: maybe the tarball was rooted at the uploads dir directly.
    log(`No top-level "uploads" dir found in tarball; using ${tmpRoot} as the uploads root.`);
    uploadsRoot = tmpRoot;
  }

  const s3 = new S3Client({
    region: AWS_REGION,
    endpoint: AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  log('Uploading files...');
  const { count, errors } = await uploadAll(uploadsRoot, s3);
  log(`Uploaded ${count} files (${errors} errors).`);

  log('Connecting to MongoDB...');
  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  let updated = 0;
  let scanned = 0;
  try {
    log('Rewriting message image_urls...');
    const res = await rewriteMessageUrls(mongo);
    scanned = res.scanned;
    updated = res.updated;
  } finally {
    await mongo.close();
  }

  // Best-effort cleanup of the temp dir.
  try {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  } catch (err) {
    console.warn('Failed to remove temp dir:', err.message);
  }

  log('=== Summary ===');
  log(`Files uploaded:    ${count}`);
  log(`Upload errors:     ${errors}`);
  log(`Messages scanned:  ${scanned}`);
  log(`Messages updated:  ${updated}`);
  log(`Dry run:           ${DRY_RUN}`);

  process.exit(errors > 0 ? 2 : 0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
