// README descriptions are the source for website text. Run with --check to
// report differences without writing the catalog.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'docs/wotlk_addons.json');
const original = fs.readFileSync(catalogPath, 'utf8');
const data = JSON.parse(original);
const check = process.argv.includes('--check');
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');

function plainText(markdown) {
  return markdown
    .replace(/<br\s*\/?>(?:\r?\n)?/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^\s]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#xA;/gi, '\n')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*>\s*/, '').replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sections(file) {
  const markdown = fs.readFileSync(path.join(root, file), 'utf8');
  const entries = [];
  for (const block of markdown.split(/(?=^#{1,3} )/m)) {
    const heading = block.match(/^### (.+)\r?\n/);
    const download = /(?:🔗|⬇️?)\s+\[Download[^\]]*\]\(([^\s]+)\)/.exec(block);
    if (!heading || !download) continue;
    const description = block.slice(heading[0].length, download.index)
      .split(/\r?\n/)
      .filter(line => !/^\s*>\s*(?:\*\*)?Requires:/i.test(line) && !/^Credits:/i.test(line.trim()))
      .map(line => line.replace(/\s+\*\*Requires:\*\*.*$/, ''))
      .join('\n')
      .replace(/\[(?:More Information|Please read the Installation Steps!|How to install for the first time)\]\([^\s]+\)/gi, '');
    entries.push({ name: heading[1].trim(), download: download[1], description: plainText(description) });
  }
  return entries;
}

const changed = [];
function sync(record, field, expected, label) {
  if (record[field] !== expected) {
    changed.push(label);
    record[field] = expected;
  }
}

const entries = sections('README.md');
const records = data.filter(record => record._type !== 'legend');
const matched = new Set();
const canonical = new Map();
for (const entry of entries) {
  let candidates = records.filter(record => normalize(record.name) === normalize(entry.name));
  if (!candidates.length) candidates = records.filter(record => record.primary_download === entry.download);
  if (candidates.length !== 1 || matched.has(candidates[0])) throw new Error(`Ambiguous or missing catalog entry: ${entry.name}`);
  if (!entry.description) throw new Error(`Missing description: ${entry.name}`);
  const record = candidates[0];
  matched.add(record);
  canonical.set(normalize(record.name), entry.description);
  sync(record, 'description_text', entry.description, entry.name);
}
if (matched.size !== records.length) throw new Error(`Catalog entries without README descriptions: ${records.filter(record => !matched.has(record)).map(record => record.name).join(', ')}`);

let plugins = 0;
for (const [name, guide] of [['ElvUI', 'docs/elvui-plugins/README.md'], ['Compact Raid Frame', 'docs/compact-raid-frame-plugins/README.md']]) {
  const addon = records.find(record => record.name === name);
  const pluginEntries = sections(guide);
  const items = addon.plugin_groups.flatMap(group => group.items);
  if (pluginEntries.length !== items.length) throw new Error(`Plugin count differs: ${guide}`);
  for (const entry of pluginEntries) {
    const candidates = items.filter(plugin => plugin.name === entry.name);
    if (candidates.length !== 1) throw new Error(`Ambiguous or missing plugin: ${entry.name}`);
    const plugin = candidates[0];
    const standalone = canonical.get(normalize(plugin.name));
    if (standalone && standalone !== entry.description) throw new Error(`Standalone and plugin README descriptions differ: ${entry.name}`);
    if (plugin.description_text !== undefined || entry.description && plugin.note === undefined) {
      sync(plugin, 'description_text', entry.description, `${name} / ${plugin.name}`);
    } else if (plugin.note !== undefined) {
      sync(plugin, 'note', entry.description, `${name} / ${plugin.name}`);
    }
    plugins++;
  }
}

if (check && changed.length) {
  console.error(`Descriptions differ (${changed.length}):\n${changed.join('\n')}`);
  process.exitCode = 1;
} else {
  if (!check && changed.length) {
    const newline = original.includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(catalogPath, (JSON.stringify(data, null, 2) + '\n').replace(/\n/g, newline));
  }
  console.log(`${records.length} descriptions and ${plugins} plugins ${check ? 'verified' : 'synchronized'}; ${changed.length} changes.`);
}
