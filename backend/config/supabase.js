const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: SUPABASE_URL and SUPABASE_KEY must be defined in your environment.');
  process.exit(1);
}

// Clean up path trailing slashes/rest endpoint suffixes if provided
let cleanUrl = supabaseUrl.trim();
if (cleanUrl.endsWith('/rest/v1/')) {
  cleanUrl = cleanUrl.slice(0, -9);
} else if (cleanUrl.endsWith('/rest/v1')) {
  cleanUrl = cleanUrl.slice(0, -8);
}
if (cleanUrl.endsWith('/')) {
  cleanUrl = cleanUrl.slice(0, -1);
}

console.log(`Initializing Supabase client targeting URL: ${cleanUrl}`);

const supabase = createClient(cleanUrl, supabaseKey.trim());

module.exports = supabase;
