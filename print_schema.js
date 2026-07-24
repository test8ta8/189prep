import fs from 'fs';

const spec = JSON.parse(fs.readFileSync('schema_openapi.json', 'utf-8'));
for (const [tableName, definition] of Object.entries(spec.definitions)) {
  console.log(`\nTABLE: ${tableName}`);
  if (definition.properties) {
    for (const [colName, colDef] of Object.entries(definition.properties)) {
      const type = colDef.format || colDef.type || 'unknown';
      console.log(`  - ${colName} (${type})`);
    }
  }
}
