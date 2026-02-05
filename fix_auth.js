const fs = require('fs');
const path = require('path');

console.log("--- STARTING FIX ---");

// 1. Detect if you are using "src" folder or just "app"
// This is the #1 cause of 404s (putting the file in the wrong root)
let appRoot = '';
if (fs.existsSync(path.join(process.cwd(), 'src', 'app'))) {
    appRoot = path.join(process.cwd(), 'src', 'app');
    console.log("Detected Project Structure: /src/app");
} else if (fs.existsSync(path.join(process.cwd(), 'app'))) {
    appRoot = path.join(process.cwd(), 'app');
    console.log("Detected Project Structure: /app (No src)");
} else {
    console.error("ERROR: Could not find 'app' directory!");
    process.exit(1);
}

// 2. Define the Auth path
// We explicitly build the path to avoid Windows bracket bugs
const apiPath = path.join(appRoot, 'api');
const authPath = path.join(apiPath, 'auth', '[...nextauth]');

// 3. Nuke the old 'api' folder to remove corrupted ghost files
if (fs.existsSync(apiPath)) {
    console.log("Removing old API folder to ensure a clean slate...");
    fs.rmSync(apiPath, { recursive: true, force: true });
}

// 4. Create the directories fresh
fs.mkdirSync(authPath, { recursive: true });

// 5. Write the route.js file
const routeCode = `import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (credentials.username === "admin" && credentials.password === "securepass123") {
          return { id: "1", name: "FamilyAdmin", email: "admin@family.com" };
        }
        return null;
      }
    })
  ]
});

export { handler as GET, handler as POST };`;

fs.writeFileSync(path.join(authPath, 'route.js'), routeCode);

console.log(`SUCCESS: Created auth route at: \n${path.join(authPath, 'route.js')}`);
