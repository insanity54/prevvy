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
    const intermediateOutput = path.join(tmpDir, `intermediate${i}.png`);
    framePromises.push(execa.command(`/usr/bin/ffmpeg -y -ss ${timestamp} -i ${input} -frames:v 1 ${intermediateOutput}`));
  }


  return Promise.all(framePromises)
    .then((result) => {
      console.log('all done.')
      console.log(result)
    })

  // combine images together to make tile

  // return image
}
