#!/usr/bin/env node
// One-shot Supabase setup for Midnight Brew.
//
//   1. runs supabase/migrations/*.sql in order: tables, security rules,
//      order functions, and the starting menu (only if the menu is empty)
//      — the same files the Supabase GitHub integration applies on merge
//   3. creates a staff login                       — if STAFF_EMAIL/STAFF_PASSWORD are set
//   4. turns off public sign-ups (only staff you add can log in)
//   5. writes .env.local and prints the two values to paste into Vercel
//
// Needs (environment variables):
//   SUPABASE_ACCESS_TOKEN  personal access token: supabase.com/dashboard/account/tokens
//   SUPABASE_PROJECT_REF   the id in your project URL: https://<ref>.supabase.co
//   STAFF_EMAIL, STAFF_PASSWORD   (optional) first staff login
//
// Run:  npm run setup:supabase
// Safe to run again: nothing is deleted, and an existing menu is left alone.

import { readFile, readdir, writeFile } from "node:fs/promises";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF first (see the top of this file).");
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}`;
const projectUrl = `https://${ref}.supabase.co`;

async function call(url, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === "object" && data ? data.message || data.msg || data.error || JSON.stringify(data) : text;
    const err = new Error(`${method} ${url} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const mgmt = (path, opts = {}) =>
  call(`${api}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);

async function runSql(file) {
  const query = await readFile(new URL(file, migrationsDir), "utf8");
  await mgmt("/database/query", { method: "POST", body: { query } });
  console.log(`✓ ran supabase/migrations/${file}`);
}

const step = async (label, fn) => {
  try {
    return await fn();
  } catch (e) {
    console.error(`✗ ${label}\n  ${e.message}`);
    process.exit(1);
  }
};

await step("checking the project", async () => {
  const p = await mgmt("");
  console.log(`✓ project "${p.name}" (${p.region}) is ${p.status}`);
});

const migrations = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) await step(`running ${f}`, () => runSql(f));

const keys = await step("reading API keys", () => mgmt("/api-keys"));
const pick = (name) => keys.find((k) => k.name === name)?.api_key;
const anon = pick("anon");
const serviceRole = pick("service_role");
if (!anon || !serviceRole) {
  console.error("✗ could not find the anon / service_role keys for this project");
  process.exit(1);
}

if (process.env.STAFF_EMAIL && process.env.STAFF_PASSWORD) {
  await step("creating the staff login", async () => {
    try {
      await call(`${projectUrl}/auth/v1/admin/users`, {
        method: "POST",
        headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
        body: { email: process.env.STAFF_EMAIL, password: process.env.STAFF_PASSWORD, email_confirm: true },
      });
      console.log(`✓ staff login created: ${process.env.STAFF_EMAIL}`);
    } catch (e) {
      if (e.status === 422 || /already/i.test(e.message)) console.log(`• staff login ${process.env.STAFF_EMAIL} already exists`);
      else throw e;
    }
  });
} else {
  console.log("• no STAFF_EMAIL / STAFF_PASSWORD given: add staff in Supabase → Authentication → Users");
}

await step("turning off public sign-ups", async () => {
  await mgmt("/config/auth", { method: "PATCH", body: { disable_signup: true } });
  console.log("✓ public sign-ups are off");
});

await writeFile(
  new URL("../.env.local", import.meta.url),
  `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\n`
);
console.log("✓ wrote .env.local (for `npm run dev`)");

console.log(`
Done. In Vercel → your project → Settings → Environment Variables, add:

  NEXT_PUBLIC_SUPABASE_URL       ${projectUrl}
  NEXT_PUBLIC_SUPABASE_ANON_KEY  ${anon}

then Redeploy. (The anon key is meant to be public; the access token is not —
you can revoke it now at supabase.com/dashboard/account/tokens.)
`);
