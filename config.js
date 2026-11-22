// Optional accounts. Leave both values empty and the site works exactly as before:
// progress stays in this browser. Fill them in (see README, "Accounts and sync") to turn sign-in on.
// supabaseAnonKey takes the project's "publishable" key (sb_publishable_...) or the older "anon" key. Never use the secret key here.
// It is meant to be public; access is restricted by the row level security in supabase/schema.sql.
window.PDEX_CONFIG = {
  supabaseUrl: "https://cdsvdkpqcfsjrjmnrwrr.supabase.co",
  supabaseAnonKey: "sb_publishable_s87_APJerYq7Cq-RQCvXwg_ptmd4FKW",
};
