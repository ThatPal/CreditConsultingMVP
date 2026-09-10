// Read-only source inventory; writes only derived, non-secret Astra audit metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/astra');
const csv = (rows) => rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const routeFile = path.join(root, 'apps/web/src/App.tsx');
const source = fs.readFileSync(routeFile, 'utf8');
const ast = ts.createSourceFile(routeFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = [];
function walk(node, prefix = '') {
  const element = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  let next = prefix;
  if (element?.tagName.getText(ast) === 'Route') {
    const attrs = element.attributes.properties;
    const p = attrs.find(a => a.name?.getText(ast) === 'path')?.initializer;
    const isIndex = attrs.some(a => a.name?.getText(ast) === 'index');
    if (p && ts.isStringLiteral(p)) next = p.text.startsWith('/') ? p.text : `${prefix}/${p.text}`;
    if (p || isIndex) {
      const el = attrs.find(a => a.name?.getText(ast) === 'element')?.initializer?.getText(ast) ?? '';
      routes.push({route: next || '/', component: el.match(/<([A-Z][\w]*)/)?.[1] ?? '', line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1});
    }
  }
  ts.forEachChild(node, child => walk(child, next));
}
walk(ast);
fs.writeFileSync(path.join(out, 'route-inventory.csv'), csv([['route', 'component', 'App.tsx line'], ...routes.map(r => [r.route, r.component, r.line])]));

const register = fs.readFileSync(path.join(out, 'SCREEN-REGISTER.md'), 'utf8');
const screens = register.split('\n').filter(l => /^\| (PUBLIC|AUTH|PORTAL|CRM|ADMIN)-\d+ \|/.test(l)).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
const ids = new Set(screens.map(s => s[0]));
if (screens.length !== 110 || ids.size !== 110) throw new Error(`Expected 110 unique contracts; got ${screens.length}/${ids.size}`);
fs.writeFileSync(path.join(out, 'screen-register.csv'), csv([['ID','Screen','Current route / coverage','Sections and completion work','Wave'], ...screens]));

const entries = [];
const conversationStats = {};
const sourceRoot = path.join(out, 'sources');
for (const family of ['drive', 'conversations']) {
  const directory = path.join(sourceRoot, family);
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory).sort()) {
    const bytes = fs.readFileSync(path.join(directory, name));
    const record = {file: `${family}/${name}`, sha256: digest(bytes), bytes: bytes.length};
    if (family === 'drive') {
      const text = bytes.toString('utf8');
      record.title = text.split('\n').find(l => l.trim())?.replace(/^#\s*/, '').trim();
      record.source = text.match(/^Source: (.+)$/m)?.[1]?.trim() ?? `https://docs.google.com/document/d/${name.replace(/\.txt$/, '')}/edit`;
    } else {
      const x = JSON.parse(bytes.toString('utf8'));
      record.title = x.thread?.title;
      record.source = `https://chatgpt.com/c/${x.thread?.id}`;
      record.turns = x.turns?.length ?? 0;
      record.attachmentCount = x.attachments?.length ?? 0;
      const key = x.thread?.id;
      const stat = conversationStats[key] ??= {title: x.thread?.title, pages: 0, turns: 0, userMessages: 0, assistantMessages: 0, attachmentReferences: 0, possibleLengthLimitedTexts: 0, explicitTruncationFlags: 0};
      stat.pages++; stat.turns += record.turns; stat.attachmentReferences += record.attachmentCount;
      function scan(value) {
        if (!value || typeof value !== 'object') return;
        if (value.type === 'userMessage') stat.userMessages++;
        if (value.type === 'agentMessage' || value.type === 'assistantMessage') stat.assistantMessages++;
        if (value.truncated === true || value.isTruncated === true) stat.explicitTruncationFlags++;
        if (typeof value.text === 'string' && value.text.length >= 19900) stat.possibleLengthLimitedTexts++;
        for (const child of Object.values(value)) if (child && typeof child === 'object') { if (Array.isArray(child)) child.forEach(scan); else scan(child); }
      }
      scan(x.turns);
    }
    entries.push(record);
  }
}
const manifest = {auditDate: '2026-09-10', baseline: 'ee3b8648b4a61ab76d4b56bd1cfd307b83bd8eb0', privateSourcesIgnored: true, routeCount: routes.length, canonicalScreenCount: screens.length, conversationStats, sources: entries};
fs.writeFileSync(path.join(out, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({routeCount: routes.length, screenCount: screens.length, driveFiles: entries.filter(e=>e.file.startsWith('drive/')).length, conversationStats}, null, 2));
