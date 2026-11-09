const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/install-tv.ps1');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acetv-installer-test-'));
const log = path.join(dir, 'calls.jsonl');
const driver = path.join(dir, 'driver.cjs');
fs.writeFileSync(driver, `const fs=require('fs'),path=require('path');const [tool,...args]=process.argv.slice(2);fs.appendFileSync(process.env.FAKE_LOG,JSON.stringify({tool,args})+'\\n');if(tool==='sdb'&&args[0]==='devices'){if(process.env.FAKE_DEVICE!=='missing')console.log('List of devices attached\\n192.0.2.10:26101 '+(process.env.FAKE_DEVICE||'device')+' DEMO_TV')}if(tool==='tizen'&&args[0]==='package'){const out=args[args.indexOf('-o')+1];fs.writeFileSync(path.join(out,'AceTV.wgt'),'synthetic')}if(tool==='tizen'&&args[0]===process.env.FAKE_FAIL)process.exit(9);`);
function tool(name) {
  const p = path.join(dir, name + (process.platform === 'win32' ? '.cmd' : '.sh'));
  fs.writeFileSync(p, process.platform === 'win32'
    ? '@echo off\r\n"' + process.execPath + '" "' + driver + '" ' + name + ' %*\r\n'
    : '#!/bin/sh\nexec "' + process.execPath + '" "' + driver + '" ' + name + ' "$@"\n');
  if (process.platform !== 'win32') fs.chmodSync(p, 0o755);
  return p;
}
const sdb = tool('sdb');
const tizen = tool('tizen');
const base = ['-TvIp', '192.0.2.10', '-SdbPath', sdb];
const installBase = base.concat(['-SecurityProfile', 'TestProfile', '-TizenPath', tizen]);
function run(args, extraEnv = {}) {
  return spawnSync(process.env.PWSH || 'pwsh', ['-NoProfile', '-File', script, ...args], {
    encoding: 'utf8', env: { ...process.env, FAKE_LOG: log, FAKE_FAIL: '', FAKE_DEVICE: 'device', ...extraEnv },
  });
}
function calls() {
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
}
function clear() { fs.rmSync(log, { force: true }); }

try {
  let r = run(installBase);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(calls().length, 0, 'default local check must not invoke SDK');
  r = run(installBase.concat('-CheckOnly'));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(calls().length, 0, '-CheckOnly must make zero SDK calls');

  clear();
  r = run(base.concat('-Diagnose'));
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(calls().map(c => [c.tool, c.args[0]]), [['sdb', 'connect'], ['sdb', 'devices']]);
  assert.match(r.stdout, /Diagnóstico correcto/);
  assert(!calls().some(c => c.tool === 'tizen'), 'diagnose must not sign or install');
  clear();
  r = run(base.concat('-Diagnose'), { FAKE_DEVICE: 'offline' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /offline/);
  clear();
  r = run(base.concat('-Diagnose'), { FAKE_DEVICE: 'missing' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no aparece en SDB/i);
  clear();

  for (const ip of ['192.0.2.10;whoami', '::1']) {
    r = run(installBase.map(v => v === '192.0.2.10' ? ip : v));
    assert.notEqual(r.status, 0);
    assert.equal(calls().length, 0);
  }
  clear();
  r = run(installBase.concat(['-Install', '-Launch']));
  assert.equal(r.status, 0, r.stderr);
  let c = calls();
  assert.deepEqual(c.map(x => x.args[0]), ['package', 'connect', 'devices', 'install', 'run']);
  const install = c.find(x => x.args[0] === 'install');
  assert.deepEqual(install.args.slice(0, 5), ['install', '-n', 'AceTV.wgt', '-s', '192.0.2.10:26101']);
  assert.equal(install.args[5], '--');
  assert.equal(fs.existsSync(install.args[6]), false, 'temporary staging removed');
  clear();
  r = run(installBase.concat(['-Install', '-TargetSerial', 'other-device']));
  assert.notEqual(r.status, 0, 'must reject another connected target');
  assert.match(r.stderr, /no coincide/);
  assert.equal(calls().length, 0, 'wrong target rejected before SDK calls');
  clear();
  r = run(installBase.concat(['-Install', '-TargetSerial', '192.0.2.10:26101', '-Launch']), { FAKE_FAIL: 'install' });
  assert.notEqual(r.status, 0, 'SDK error must fail');
  assert(!calls().some(x => x.args[0] === 'run'), 'must not launch after failure');
  assert(!calls().some(x => /uninstall|shell/.test(x.args[0])));
  console.log('PASS installer local checks, zero-call -CheckOnly, read-only diagnosis, offline/missing-device errors, explicit target validation, simulated install/launch and failure propagation.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
