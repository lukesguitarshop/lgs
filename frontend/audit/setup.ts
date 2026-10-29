/**
 * Global setup for the mobile audit: seeds the two audit accounts (customer +
 * admin) in the LOCAL database, signs them in, and collects real sample ids for
 * every dynamic route segment. Everything lands in mobile-audit/.state.json for
 * the spec to read.
 *
 * Local only. It refuses to run against anything but a localhost API/Mongo, so
 * it can never seed accounts on dev or production.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = process.env.AUDIT_API_URL ?? 'http://localhost:5000/api';
const MONGO = process.env.AUDIT_MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.AUDIT_MONGO_DB ?? 'GuitarDb';

// Throwaway accounts that exist only for this audit. .test never resolves, so
// even a misconfigured mailer can't deliver the verification email anywhere.
export const AUDIT_ACCOUNTS = {
  customer: { email: 'mobile-audit-customer@lgs.test', password: 'mobile-audit-pw-1', fullName: 'Audit Customer' },
  admin: { email: 'mobile-audit-admin@lgs.test', password: 'mobile-audit-pw-1', fullName: 'Audit Admin' },
} as const;

export const STATE_FILE = path.join(__dirname, '..', 'mobile-audit', '.state.json');

export interface AuditState {
  sessions: Record<'customer' | 'admin', { token: string; user: unknown }>;
  samples: Record<string, string | null>;
}

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    throw new Error(`mobile audit seeds test accounts and only runs against localhost (got ${url})`);
  }
}

async function post<T>(url: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as T };
}

export default async function globalSetup() {
  assertLocal(API);
  assertLocal(MONGO);

  // The mongodb driver comes from scripts/ (npm install there), not the frontend.
  const req = createRequire(path.join(__dirname, '..', '..', 'scripts', 'package.json'));
  const { MongoClient } = req('mongodb');
  const client = await MongoClient.connect(MONGO);
  const db = client.db(DB_NAME);
  const users = db.collection('users');

  const sessions = {} as AuditState['sessions'];
  for (const role of ['customer', 'admin'] as const) {
    const acct = AUDIT_ACCOUNTS[role];
    if (!(await users.findOne({ email: acct.email }))) {
      const reg = await post(`${API}/auth/register`, acct);
      if (reg.status >= 400) throw new Error(`register ${acct.email} failed: ${reg.status} ${JSON.stringify(reg.json)}`);
    }
    await users.updateOne({ email: acct.email }, { $set: { email_verified: true, is_admin: role === 'admin' } });
    const login = await post<{ token: string; user: unknown }>(`${API}/auth/login`, { email: acct.email, password: acct.password });
    if (!login.json.token) throw new Error(`login ${acct.email} failed: ${login.status} ${JSON.stringify(login.json)}`);
    sessions[role] = { token: login.json.token, user: login.json.user };
  }

  const firstId = async (coll: string, filter: object = {}) => {
    const doc = await db.collection(coll).findOne(filter, { sort: { _id: -1 }, projection: { _id: 1 } });
    return doc ? String(doc._id) : null;
  };
  const customer = await users.findOne({ email: AUDIT_ACCOUNTS.customer.email });

  // The trade-in pages need one to render. Submitting through the API uploads
  // photos to object storage, so write a photo-less one straight to local Mongo.
  const tradeIns = db.collection('trade_in_requests');
  if (customer && !(await tradeIns.findOne({ user_id: String(customer._id) }))) {
    await tradeIns.insertOne({
      user_id: String(customer._id),
      email: AUDIT_ACCOUNTS.customer.email,
      brand: 'Gibson',
      model: 'Les Paul Standard 50s with a deliberately long model name to stress wrapping',
      condition: 'Very Good',
      notes: 'Seeded by the mobile layout audit.',
      photos: [],
      offers: [],
      status: 'submitted',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  const samples: AuditState['samples'] = {
    listing: (await firstId('my_listings', { disabled: false })) ?? (await firstId('my_listings')),
    order: await firstId('orders'),
    reservation: await firstId('reservations'),
    tradeIn: await firstId('trade_in_requests'),
    conversation: await firstId('conversations'),
    user: customer ? String(customer._id) : null,
  };

  await client.close();
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ sessions, samples } satisfies AuditState, null, 2));
}
