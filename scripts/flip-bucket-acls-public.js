#!/usr/bin/env node
/*
 * Walk every object in a Tigris bucket and set its ACL to public-read.
 *
 * Required env vars:
 *   AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BUCKET_NAME
 * Optional:
 *   AWS_REGION (defaults to "auto"), PREFIX (defaults to ""), --dry-run
 */
'use strict';

const {
  S3Client,
  ListObjectsV2Command,
  PutObjectAclCommand,
} = require('@aws-sdk/client-s3');

function need(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}`); process.exit(1); }
  return v;
}

const ENDPOINT = need('AWS_ENDPOINT_URL_S3');
const KEY = need('AWS_ACCESS_KEY_ID');
const SECRET = need('AWS_SECRET_ACCESS_KEY');
const BUCKET = need('BUCKET_NAME');
const REGION = process.env.AWS_REGION || 'auto';
const PREFIX = process.env.PREFIX || '';
const DRY = process.argv.includes('--dry-run');

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});

async function main() {
  console.log(`Flipping ACL=public-read on bucket=${BUCKET} prefix="${PREFIX}" dry=${DRY}`);
  let token;
  let total = 0, ok = 0, errs = 0;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: PREFIX, ContinuationToken: token,
    }));
    for (const obj of list.Contents || []) {
      total++;
      if (DRY) {
        console.log(`DRY: would flip ${obj.Key}`);
        ok++;
        continue;
      }
      try {
        await s3.send(new PutObjectAclCommand({
          Bucket: BUCKET, Key: obj.Key, ACL: 'public-read',
        }));
        ok++;
        if (ok % 25 === 0) console.log(`Flipped ${ok}/${total}...`);
      } catch (e) {
        errs++;
        console.error(`Failed ${obj.Key}: ${e.message}`);
      }
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);

  console.log(`Done. total=${total} ok=${ok} errs=${errs}`);
  process.exit(errs > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
