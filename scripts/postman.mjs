// Generates one Postman collection per service from services/<service>/openapi.json (Spec 1 §11).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import converter from 'openapi-to-postmanv2';

const ID_VARS = {
  stores: 'storeId',
  products: 'productId',
  addresses: 'addressId',
  orders: 'orderId',
  riders: 'riderId',
  deliveries: 'deliveryId',
};

// Per service: the environment variable holding its base URL, and the token its own /auth and /me routes read.
const SERVICES = {
  core: { baseUrl: 'baseUrl', ownToken: 'customerToken' },
  rider: { baseUrl: 'riderBaseUrl', ownToken: 'riderToken' },
};

function tokenVar(path, svc) {
  if (path[0] === 'admin') return 'staffToken';
  return path[0] === 'auth' || path[0] === 'me' ? svc.ownToken : 'customerToken';
}

function returnsToken(item) {
  return item.response.some((r) => {
    if (r.code < 200 || r.code > 299) return false;
    try { return typeof JSON.parse(r.body).token === 'string'; } catch { return false; }
  });
}

function stripIds(node) {
  if (Array.isArray(node)) node.forEach(stripIds);
  else if (node && typeof node === 'object') {
    delete node.id;
    delete node._postman_id;
    Object.values(node).forEach(stripIds);
  }
}

function fixRequest(item, svc) {
  const { url, auth } = item.request;
  if (auth?.type === 'bearer') auth.bearer = [{ key: 'token', value: `{{${tokenVar(url.path, svc)}}}`, type: 'string' }];
  for (const v of url.variable) {
    const name = ID_VARS[url.path[url.path.indexOf(`:${v.key}`) - 1]];
    if (name && (v.key === 'id' || v.key === name)) v.value = `{{${name}}}`;
  }
  if (url.path.includes('auth') && returnsToken(item)) {
    item.event.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: [`pm.environment.set('${tokenVar(url.path, svc)}', pm.response.json().token);`] },
    });
  }
}

function walk(items, svc) {
  for (const item of items) (item.item ? walk(item.item, svc) : fixRequest(item, svc));
}

export async function generate(spec, service = 'core') {
  const svc = SERVICES[service];
  const result = await new Promise((resolve, reject) =>
    converter.convertV2(
      { type: 'json', data: structuredClone(spec) },
      { folderStrategy: 'Tags', parametersResolution: 'Example' },
      (err, res) => (err ? reject(err) : resolve(res)),
    ),
  );
  if (!result.result) throw new Error(`openapi-to-postmanv2: ${result.reason}`);
  const collection = result.output[0].data;
  delete collection.variable; // the base URL comes from the environment
  walk(collection.item, svc);
  stripIds(collection);
  // The converter roots every URL at {{baseUrl}}; each service reads its own variable.
  return `${JSON.stringify(collection, null, 2).replaceAll('"{{baseUrl}}"', `"{{${svc.baseUrl}}}"`)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const service of Object.keys(SERVICES)) {
    const contract = new URL(`../services/${service}/openapi.json`, import.meta.url);
    if (!existsSync(contract)) {
      console.log(`postman: services/${service}/openapi.json absent, skipping`);
      continue;
    }
    const out = new URL(`../docs/postman/shopperstop-${service}.postman_collection.json`, import.meta.url);
    writeFileSync(out, await generate(JSON.parse(readFileSync(contract, 'utf8')), service));
  }
}
