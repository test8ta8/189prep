import 'dotenv/config';
import fs from 'fs';

async function fetchSchema() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const res = await fetch(url);
  const data = await res.json();
  fs.writeFileSync('schema_openapi.json', JSON.stringify(data, null, 2));
  console.log('OpenAPI Schema downloaded to schema_openapi.json');
}

fetchSchema().catch(console.error);
