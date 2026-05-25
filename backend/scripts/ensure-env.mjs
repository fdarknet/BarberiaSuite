import fs from "node:fs";
import path from "node:path";

const here = path.resolve(process.cwd());
const envPath = path.join(here, ".env");
const examplePath = path.join(here, ".env.example");

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log("✅ Created backend/.env from .env.example");
  } else {
    console.log("⚠️  No .env or .env.example found in backend/");
  }
}
