#!/usr/bin/env node

const fs = require('fs'),
    log = console.log,
    mkdirp = require('mkdirp'),
    net = require('net'),
    listenPort = process.argv[5] || 8080,
    localHost = process.argv[4] || require('os').networkInterfaces().en0.find((it) => it.family === 'IPv4').address,
    parentLogDir = (process.argv[6] || './log') + '/' + Date.now(),
    targetHost = process.argv[2] || 'example.com',
    targetPort = process.argv[3] || 443,
    tls = require('tls'),
    ___end___ = true;

if(process.argv[2] === '-h' || process.argv[2] === '--help') {
  console.log(`
    ${process.argv[1]} <target_host> <target_port> <local_host> <local_port> <log_path>
  `);
  process.exit();
}

let lastConnectionId = 0;

log(`Creating log directory at ${parentLogDir}...`);
try { mkdirp.sync(parentLogDir); } catch(e) { log(e.message); }

log(`Starting server on port ${listenPort}...`);

const server = net.createServer();

server.on('close', (e) => log('Finished.', e));
server.on('connection', (downstream) => {
  console.log('Connection opened.');

  const cid = ++lastConnectionId,
      logDir = `${parentLogDir}/${cid}`,
      upstream = tls.connect(targetPort, targetHost);

  mkdirp.sync(logDir);

  upstream.on('connect', () => {
    downstream.on('data', (data) => {
      const raw = data.toString(),
          filtered = raw.replace(/Host: .*/, `Host: ${targetHost}`)
                        .replace(/Connection: Keep-Alive/i, 'Connection: close')
                        .replace(/Date: .*/, `Date: ${new Date().toUTCString()}`);

      upstream.write(filtered, () => log(cid, 'upstream.write()'));
      fs.appendFile(`${logDir}/request.raw`, raw, () => log(cid, 'request.raw append'));
      fs.appendFile(`${logDir}/request.filtered`, filtered, () => log(cid, 'request.filtered append'));
      console.log(cid, 'Received data from downstream:', data);
    });
  });

  upstream.on('data', (data) => {
    const raw = data.toString(),
        filtered = raw.replace(new RegExp(`Location: https://${targetHost}/(.*)`), `Location: http://${localHost}:${listenPort}/$1`);

    downstream.write(filtered, () => log(cid, 'downstream.write()'));
    fs.appendFile(`${logDir}/response.raw`, raw, () => log(cid, 'response.raw append'));
    fs.appendFile(`${logDir}/response.filtered`, filtered, () => log(cid, 'response.filtered append'));
    console.log(cid, 'Received from upstream:', data);
  });

  downstream.on('close', (e) => console.log(cid, 'downstream', 'close', e));
  downstream.on('connect', (e) => console.log(cid, 'downstream', 'connect', e));
  downstream.on('drain', (e) => console.log(cid, 'downstream', 'drain', e));
  downstream.on('end', (e) => console.log(cid, 'downstream', 'end', e));
  downstream.on('error', (e) => console.log(cid, 'downstream', 'error', e));
  downstream.on('lookup', (e) => console.log(cid, 'downstream', 'lookup', e));
  downstream.on('timeout', (e) => console.log(cid, 'downstream', 'timeout', e));

  upstream.on('close', (e) => console.log(cid, 'upstream', 'close', e));
  upstream.on('drain', (e) => console.log(cid, 'upstream', 'drain', e));
  upstream.on('end', (e) => console.log(cid, 'upstream', 'end', e));
  upstream.on('error', (e) => console.log(cid, 'upstream', 'error', e));
  upstream.on('lookup', (e) => console.log(cid, 'upstream', 'lookup', e));
  upstream.on('timeout', (e) => console.log(cid, 'upstream', 'timeout', e));
});
server.on('error', log);
server.on('listening', log);

server.listen(listenPort);
