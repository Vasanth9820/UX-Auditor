// Tiny static server for the demo site — run with: node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4000;
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split("?")[0];
  let filePath = path.join(__dirname, cleanUrl === "/" ? "index.html" : cleanUrl);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
  
  if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  const ext = path.extname(filePath) || ".html";
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Demo site: http://localhost:${PORT}`));
