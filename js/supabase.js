
// Supabase project credentials
const SUPABASE_URL = "https://kbmntqwzuwtpypeuhzaa.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LqJAJDlux1Yc_00XzDZY2w_1tlSDpG1";

// Create the Supabase connection
const { createClient } = window.supabase;

window.supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("Aralytics connected to Supabase!");
