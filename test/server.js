/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const express = require('express');
const app     = express();
const path    = require('path');
var bodyParser = require('body-parser')

module.exports = app;

const project_root = path.resolve(__dirname, '..');
app.use(express.static(project_root));
app.use(express.static(project_root + 'node_modules/mocha'));
app.use(express.static(project_root + 'node_modules/chai'));

app.use(bodyParser());

const mime = function(req) {
  const type = req.headers['content-type'] || '';
  return type.split(';')[0];
};

const dump = function(obj) {
  if (!obj) { obj = ''; }
  if (obj && (typeof obj !== "string")) { obj = JSON.stringify(obj); }
  return obj;
};

const cleanTrace = function(traceStr) {
  const trace = traceStr.split("\n");
  const filtered = [];
  for (let line of Array.from(trace)) {
    if (/\.html:/.test(line)) {
      line = line.replace(/^.+?@/, '');
      line = line.replace(/http:\/\/.+?\//, '');
      line = line.replace(/(:\d+):\d+$/, '$1');
      filtered.push(line);
    }
  }
  return filtered;
};

const browser = function(ua) {
  let m;
  if ((m = ua.match(/(Android .+?);/))) {
    return m[1];
  } else if ((m = ua.match(/(iPhone|iPad|iPod).*?OS ([\d_]+)/))) {
    return `iOS ${m[2].replace(/_/g, '.')}`;
  } else if ((m = ua.match(/(Chrome\/[\d.]+)/))) {
    return m[1].replace('/', ' ');
  } else if ((m = ua.match(/(Safari\/[\d.]+)/))) {
    return m[1].replace('/', ' ');
  } else if ((m = ua.match(/(Firefox\/[\d.]+)/))) {
    return m[1].replace('/', ' ');
  } else if ((m = ua.match(/\bMS(IE [\d.]+)/))) {
    return m[1];
  } else {
    return ua;
  }
};

app.all('/', (req, res) => res.redirect('/test'));

app.all('/test/echo=?', function(req, res) {
  res.set('Cache-Control', 'no-cache');
  return res.send(`\
${req.method} ?${dump(req.query)}
content-type: ${mime(req)}
accept: ${req.headers['accept']}
${dump(req.body)}\
`
  );
});

app.get('/test/jsonp', (req, res) =>
  res.jsonp({
    query: req.query,
    hello: 'world'
  })
);

// send JSONP response despite callback not being set
app.get('/test/jsonpBlah', function(req, res) {
  res.set('Content-Type', 'text/javascript');
  return res.send('blah()');
});

app.get('/test/json', function(req, res) {
  res.set('Cache-Control', 'no-cache');
  const expectedType = req.headers['accept'];
  if ((expectedType === '*/*') || /json/.test(expectedType)) {
    if (req.query.invalid) {
      res.set('Content-Type', 'application/json');
      return res.send('invalidJSON');
    } else {
      return res.json({
        query: req.query,
        hello: 'world'
      });
    }
  } else {
    return res.send(400, 'FAIL');
  }
});

app.get('/test/taintedJSON', function(req, res) {
  res.set('Content-Type', 'application/json');
  return res.send('while(1);{"hello" : "world"}');
});

app.post('/test/create', (req, res) =>
  res.json({
    action: 'created',
    query: req.query,
    payload: req.body
  })
);

app.all('/test/slow', (req, res) =>
  setTimeout(() => res.jsonp({result: 'ok'})
  , 200)
);

app.get('/test/cached', function(req, res) {
  res.set('Cache-Control', 'max-age=2');
  res.set('Expires', new Date(Date.now() + 2000).toUTCString());
  const now = new Date();
  return res.send(now.getTime().toString());
});

app.get('/test/auth', function(req, res) {
  if (req.headers.authorization === 'Basic emVwdG86ZG9nZQ==') {
    return res.send(200);
  } else {
    res.set('WWW-Authenticate', `Basic realm=\"${req.query.realm}\"`);
    return res.send(401);
  }
});

app.post('/test/log', function(req, res) {
  const params = req.body;
  const trace = cleanTrace(params.trace);
  console.log("[%s] %s: %s", browser(req.headers['user-agent']), params.name, params.message);
  if (trace.length) { console.log(trace.join("\n").replace(/^/mg, '  ')); }
  return res.send(200);
});

app.all('/test/error', (req, res) => res.send(500, 'BOOM'));

if (process.argv[1] === __filename) {
  let port = process.argv[2];
  if (!port) {
    port = 3000;
    console.log(`Listening on port ${port}`);
  }
  app.listen(port);
}
