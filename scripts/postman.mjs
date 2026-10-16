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
  payments: 'paymentId',
};

// Per service: the environment variable holding its base URL, and the token its own /auth and /me routes read.
const SERVICES = {
  core: { baseUrl: 'baseUrl', ownToken: 'customerToken' },
  rider: { baseUrl: 'riderBaseUrl', ownToken: 'riderToken' },
  payment: { baseUrl: 'paymentBaseUrl', ownToken: 'customerToken' },
};

function tokenVar(path, svc) {
  if (path[0] === 'admin') return 'staffToken';
  return path[0] === 'auth' || path[0] === 'me' ? svc.ownToken : 'customerToken';
}

// ponytail: a filled value is deterministic, not valid; a contract that wants a runnable request gives an example.
function fillExamples(spec) {
  const lists = [
    Object.values(spec.components?.parameters ?? {}),
    ...Object.values(spec.paths ?? {}).flatMap((item) => [item.parameters ?? [], ...Object.values(item).map((op) => op?.parameters ?? [])]),
  ];
  for (const p of lists.flat()) {
    if (p.$ref || 'example' in p || p.examples || p.schema?.example !== undefined || p.schema?.examples) continue;
    p.example = p.schema?.default ?? p.schema?.enum?.[0] ?? `<${p.name}>`;
  }
}

// The operations the contract marks x-service-token: true, as "METHOD path" with the converter's :id paths.
function serviceOperations(spec) {
  return new Set(Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
    Object.entries(item).filter(([, op]) => op?.['x-service-token'] === true)
      .map(([method]) => `${method.toUpperCase()} ${path.slice(1).replace(/{([^}]+)}/g, ':$1')}`)));
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

function fixRequest(item, svc, serviceOps) {
  const { url, auth } = item.request;
  const token = serviceOps.has(`${item.request.method} ${url.path.join('/')}`) ? 'serviceToken' : tokenVar(url.path, svc);
  if (auth?.type === 'bearer') auth.bearer = [{ key: 'token', value: `{{${token}}}`, type: 'string' }];
  // Saved example responses name the same environment ids as the request.
  for (const u of [url, ...item.response.map((r) => r.originalRequest?.url).filter(Boolean)]) {
    for (const v of u.variable ?? []) {
      const name = ID_VARS[u.path[u.path.indexOf(`:${v.key}`) - 1]];
      if (name && (v.key === 'id' || v.key === name)) v.value = `{{${name}}}`;
    }
  }
  if (url.path.includes('auth') && returnsToken(item)) {
    item.event.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: [`pm.environment.set('${tokenVar(url.path, svc)}', pm.response.json().token);`] },
    });
  }
}

function walk(items, svc, serviceOps) {
  for (const item of items) (item.item ? walk(item.item, svc, serviceOps) : fixRequest(item, svc, serviceOps));
}

export async function generate(spec, service = 'core') {
  const svc = SERVICES[service];
  const data = structuredClone(spec);
  fillExamples(data);
  const result = await new Promise((resolve, reject) =>
    converter.convertV2(
      { type: 'json', data },
      { folderStrategy: 'Tags', parametersResolution: 'Example' },
      (err, res) => (err ? reject(err) : resolve(res)),
    ),
  );
  if (!result.result) throw new Error(`openapi-to-postmanv2: ${result.reason}`);
  const collection = result.output[0].data;
  delete collection.variable; // the base URL comes from the environment
  walk(collection.item, svc, serviceOperations(spec));
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
