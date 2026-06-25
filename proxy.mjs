import http from "http";

const TARGET_PORT = 20787;
const PROXY_PORT = 5000;

const server = http.createServer((req, res) => {
  const options = {
    hostname: "localhost",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxy.on("error", (err) => {
    res.writeHead(502);
    res.end("Proxy error: " + err.message);
  });

  req.pipe(proxy, { end: true });
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Proxy listening on port ${PROXY_PORT} → localhost:${TARGET_PORT}`);
});
