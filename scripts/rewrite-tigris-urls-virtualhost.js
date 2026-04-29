// Rewrite Tigris URLs in dev DB from path-style (auth-only API endpoint)
// to virtual-host style (publicly readable).
//
// Usage from mongosh, connected to the GuitarDb_Dev database:
//   load("scripts/rewrite-tigris-urls-virtualhost.js")
// or pass via --file.

const oldPrefix = "https://fly.storage.tigris.dev/lgs-dev-uploads/";
const newPrefix = "https://lgs-dev-uploads.fly.storage.tigris.dev/";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let trChanged = 0;
db.trade_in_requests.find({}).forEach(function (doc) {
  let dirty = false;
  if (Array.isArray(doc.photos)) {
    doc.photos.forEach(function (p) {
      if (typeof p.url === "string" && p.url.startsWith(oldPrefix)) {
        p.url = newPrefix + p.url.slice(oldPrefix.length);
        dirty = true;
      }
    });
  }
  if (doc.shipping && typeof doc.shipping.label_url === "string" && doc.shipping.label_url.startsWith(oldPrefix)) {
    doc.shipping.label_url = newPrefix + doc.shipping.label_url.slice(oldPrefix.length);
    dirty = true;
  }
  if (dirty) {
    db.trade_in_requests.updateOne({ _id: doc._id }, { $set: { photos: doc.photos, shipping: doc.shipping } });
    trChanged++;
  }
});

let msgChanged = 0;
db.messages.find({ image_urls: { $elemMatch: { $regex: "^" + escapeRegex(oldPrefix) } } }).forEach(function (doc) {
  const next = doc.image_urls.map(function (u) {
    return (typeof u === "string" && u.startsWith(oldPrefix)) ? newPrefix + u.slice(oldPrefix.length) : u;
  });
  db.messages.updateOne({ _id: doc._id }, { $set: { image_urls: next } });
  msgChanged++;
});

print("trade-ins updated:", trChanged, "messages updated:", msgChanged);
