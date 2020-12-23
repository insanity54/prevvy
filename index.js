const execa = require('execa');
const probe = require('ffmpeg-probe');
const { DateTime, Duration } = require('luxon');
const Promise = require('bluebird');
const os = require('os');
const path = require('path');

const tmpDir = path.join(__dirname, 'tmp');

module.exports = async (options) => {
  const { input, output, width, cols, rows } = options;



  // get the length of the video
  const info = await probe(input);
  console.log(`input.duration:${info.duration}`);

  // determine the tile count
  const tileCount = cols*rows;

  // use ffmpeg to get equidistant snapshots
  const msSlice = parseInt(info.duration/tileCount);
  console.log(`${msSlice}, ${tileCount}`);

  let framePromises = [];
  for (var i=0; i<tileCount; i++) {
    const timestamp = Duration.fromMillis(i*msSlice).toFormat('h:m:s');
    const intermediateOutput = path.join(tmpDir, `prevvy_intermediate${i}.png`);
    framePromises.push(execa.command(`/usr/bin/ffmpeg -y -ss ${timestamp} -i ${input} -frames:v 1 ${intermediateOutput}`));
  }


  let result = await Promise.all(framePromises);

  const makeLayout = (i, t, c, r) => {
    const currentColumn = Math.floor(i/r);
    const currentRow = Math.floor(i/c);
    console.log(`makeLayout ${i} is on column ${currentColumn}`)
    return `w${i}_${0}`
    // `0_0|w0_0|0_h0|w0_h0|w1_1|1_h1|w1_h1`

    // 0  1  2  3  4   5
    // 6  7  8  9  10  11
    // 12 13 14 15 16  17

  }

  // combine images together to make tile
  let inputFiles = [];
  let map = [];
  let layout = [];
  for (var i=0; i<tileCount; i++) {
    inputFiles.push(`-i ${tmpDir}/prevvy_intermediate${i}.png `);
    map.push(`[${i}:v]`);
    layout.push(makeLayout(i, tileCount, cols, rows));
  }

  console.log(layout)



  return execa.command(`/usr/bin/ffmpeg -y ${inputFiles.join(' ')}-filter_complex ${map.join('')}xstack=inputs=${tileCount}:layout=${layout.join('|')}[v] -map [v] ${output}`);
  // return image
}
