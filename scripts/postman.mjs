// Generates the Postman collection from services/core/openapi.json (Spec 1 §11).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import converter from 'openapi-to-postmanv2';

const ID_VARS = { stores: 'storeId', products: 'productId', addresses: 'addressId', orders: 'orderId' };

function tokenVar(path) {
  return path[0] === 'admin' ? 'staffToken' : 'customerToken';
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

function fixRequest(item) {
  const { url, auth } = item.request;
  if (auth?.type === 'bearer') auth.bearer = [{ key: 'token', value: `{{${tokenVar(url.path)}}}`, type: 'string' }];
  for (const v of url.variable) {
    const name = ID_VARS[url.path[url.path.indexOf(`:${v.key}`) - 1]];
    if (v.key === 'id' && name) v.value = `{{${name}}}`;
  }
  if (url.path.includes('auth') && returnsToken(item)) {
    item.event.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: [`pm.environment.set('${tokenVar(url.path)}', pm.response.json().token);`] },
    });
  }
}

function walk(items) {
  for (const item of items) (item.item ? walk(item.item) : fixRequest(item));
}

export async function generate(spec) {
  const result = await new Promise((resolve, reject) =>
    converter.convertV2(
      { type: 'json', data: structuredClone(spec) },
      { folderStrategy: 'Tags', parametersResolution: 'Example' },
      (err, res) => (err ? reject(err) : resolve(res)),
    ),
  );
  if (!result.result) throw new Error(`openapi-to-postmanv2: ${result.reason}`);
  const collection = result.output[0].data;
  delete collection.variable; // baseUrl comes from the environment
  walk(collection.item);
  stripIds(collection);
  return `${JSON.stringify(collection, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const spec = JSON.parse(readFileSync(new URL('../services/core/openapi.json', import.meta.url), 'utf8'));
  writeFileSync(new URL('../docs/postman/shopperstop-core.postman_collection.json', import.meta.url), await generate(spec));
}
