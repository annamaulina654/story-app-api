require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseStorageBucket = process.env.SUPABASE_STORAGE_BUCKET;

if (!supabaseUrl || !supabaseServiceKey || !supabaseStorageBucket) {
    console.error('Missing Supabase environment variables! Please check your .env file.');
    process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase, supabaseStorageBucket };