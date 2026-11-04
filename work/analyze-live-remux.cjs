const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const sandbox={window:{},console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('work/toolchain/muxjs/package/dist/mux.min.js','utf8'),sandbox);
const muxjs=sandbox.muxjs;
vm.runInContext(fs.readFileSync('work/acetv-live-probe/app/ts-gop-splitter.js','utf8'),sandbox);

const mediaDir = 'work/acetv-video-probe/app/media';
const allTs = fs.readdirSync(mediaDir)
  .filter((name) => /^test-\d+\.ts$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .map((name) => fs.readFileSync(path.join(mediaDir, name)));
const input = Buffer.concat(allTs);
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-live-analysis-'));
const chunkSize = 196224;

function transmux(name, pushChunks) {
  const transmuxer = new muxjs.mp4.Transmuxer({ remux: true });
  const segments = [];
  const timings = [];
  transmuxer.on('data', (segment) => segments.push(segment));
  transmuxer.on('videoSegmentTimingInfo', (info) => timings.push({ track: 'video', start: info.start, end: info.end }));
  transmuxer.on('audioSegmentTimingInfo', (info) => timings.push({ track: 'audio', start: info.start, end: info.end }));
  for (const chunk of pushChunks) {
    transmuxer.push(new Uint8Array(chunk));
    transmuxer.flush();
  }
  if (segments.length === 0) throw new Error(`${name}: mux.js emitted no segments`);
  const file = path.join(outDir, `${name}.mp4`);
  const outputs = [];
  for (const segment of segments) {
    if (!segment.initSegment && !segment.data) continue;
    if (segment.initSegment?.length && !outputs.length) outputs.push(Buffer.from(segment.initSegment));
    if (segment.data?.length) outputs.push(Buffer.from(segment.data));
  }
  fs.writeFileSync(file, Buffer.concat(outputs));
  const ffprobe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,dts_time,duration_time,flags',
    '-of', 'json', file,
  ], { encoding: 'utf8' }));
  const packets = ffprobe.packets || [];
  const starts = packets.map((p) => Number(p.pts_time)).filter(Number.isFinite);
  const deltas = starts.slice(1).map((v, i) => v - starts[i]);
  const positive = deltas.filter((v) => v > 0);
  const gaps = positive.filter((v) => v > 0.05);
  const summary = {
    name, inputBytes: input.length, transmuxSegments: segments.length,
    outputBytes: fs.statSync(file).size, videoPackets: packets.length,
    firstPts: starts[0], lastPts: starts.at(-1),
    largestPositivePtsStep: Math.max(...positive),
    ptsGapsOver50ms: gaps.length,
    sampleGaps: gaps.slice(0, 12),
    timingEvents: timings.slice(0, 4),
    file,
  };
  console.log(JSON.stringify(summary));
  return summary;
}

transmux('arbitrary-196224', Array.from({ length: Math.ceil(input.length / chunkSize) }, (_, i) =>
  input.subarray(i * chunkSize, Math.min(input.length, (i + 1) * chunkSize))));
transmux('continuous-single-flush', [input]);
const gops=[];const splitter=new sandbox.TsGopSplitter(bytes=>gops.push(bytes));
for(let i=0;i<input.length;i+=chunkSize)splitter.push(input.subarray(i,i+chunkSize));splitter.end();
const fixed=transmux('gop-aligned',gops);
if(fixed.videoPackets!==800||fixed.ptsGapsOver50ms!==0)throw Error('GOP alignment did not preserve the 800-frame fixture');
