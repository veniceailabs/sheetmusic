import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
const manifestPath = path.join(outDir, "routes-manifest.json");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const manifest = {
  version: 1,
  pages404: true,
  caseSensitive: false,
  basePath: "",
  redirects: [],
  headers: [],
  dynamicRoutes: [],
  staticRoutes: ["/"],
  dataRoutes: [],
  rewrites: {
    beforeFiles: [],
    afterFiles: [],
    fallback: []
  },
  sortedPages: ["/"],
  rsc: {}
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
