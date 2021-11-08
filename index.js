const ffmpeg = require('fluent-ffmpeg');
const { DateTime, Duration } = require('luxon');
const Promise = require('bluebird');
const os = require('os');
const path = require('path');
const debug = require('debug')('prevvy');
const execa = require('execa');

class Prevvy {
  constructor(opts) {
    this.tmpDir = os.tmpdir();
    this.input = opts.input;
    this.output = opts.output;
    this.cols = opts.cols;
    this.rows = opts.rows;
    this.width = opts.width;
    this.tileCount = this.rows*this.cols;
    if (typeof this.input === 'undefined') throw new Error('input is required in options. got undefined.')
    if (typeof this.output === 'undefined') throw new Error('output is required in options. got undefined.')
    if (typeof this.cols === 'undefined') throw new Error('cols is required in options. got undefined.')
    if (typeof this.rows === 'undefined') throw new Error('rows is required in options. got undefined.')
    if (typeof this.width === 'undefined') throw new Error('width is required in options. got undefined.')
  }

  makeLayout (i) {
    // see https://ffmpeg.org/ffmpeg-filters.html#xstack for the madness
    const currentColumn = i%this.cols;
    const currentRow = Math.floor(i/this.cols);
    let colSide = [];
    let rowSide = [];
    if (currentColumn === 0) {
      colSide.push('0');
    } else {
      for (var j = 0; j<currentColumn; j++) {
        colSide.push('w0');
      }
    }
    if (currentRow === 0) {
      rowSide.push('0');
    } else {
      for (var j = 0; j<currentRow; j++) {
        rowSide.push('h0');
      }
    }
    return `${colSide.join('+')}_${rowSide.join('+')}`;
  }


  async ffmpegSeekP (timestamp, intermediateOutput) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .addOption('-ss', timestamp)
        .addOption('-i', this.input)
        .addOption('-frames:v', '1')
        .on('start', (cmd) => { debug(`Spawned ffmpeg with command ${cmd}`) })
        .on('end', function(idk) {
          setTimeout(() => {
            resolve(intermediateOutput);
          }, 1000);
        })
        .on('error', function(e) {
          debug(e);
          reject(e);
        })
        .save(intermediateOutput);
    })
  }

  async ffmpegCombineP (inputFiles, streams, layouts) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      inputFiles.forEach((inputFile) => {
        command.input(inputFile);
      })
      command
        .addOption('-y')
        .addOption('-filter_complex', `${streams.join('')}xstack=inputs=${this.tileCount}:layout=${layouts.join('|')}[v];[v]scale=${Math.floor(this.width*this.cols)}:-1[scaled]`)
        .addOption('-map', '[scaled]')
        .on('start', (cmd) => debug(`Spawned ffmpeg with command ${cmd}`))
        .on('end', function() {
          resolve();
        })
        .on('error', function(e) {
          debug(e);
          reject(e);
        })
        .save(this.output);
    })
  }

  async ffprobeP (input) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(input, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async getVideoDurationInSeconds (videoFilePath) {
    const { stdout } = await execa('ffprobe', ['-v', 'error', '-show_format', '-show_streams', videoFilePath]);
    const matched = stdout.match(/duration="?(\d*\.\d*)"?/)
    if (matched && matched[1]) return parseFloat(matched[1])
  }

  async generate () {
    // get the length of the video
    const durationS = await this.getVideoDurationInSeconds(this.input);

    const durationMs = durationS * 1000;
    debug(`durationMs: ${durationMs}, durationS: ${durationS}`)

    // use ffmpeg to get equidistant snapshots
    const msSlice = parseInt(durationMs/this.tileCount);

    let frameData = [];
    for (var i=0; i<this.tileCount; i++) {
      const timestamp = Duration.fromMillis(i*msSlice).toFormat('h:m:s');
      const intermediateOutput = path.join(this.tmpDir, `prevvy_intermediate${i}.png`);
      frameData.push([timestamp, intermediateOutput]);
    }

    // throttle https requests (concurrency 1)
    let result = await Promise.map(
      frameData,
      (data) => { 
        return this.ffmpegSeekP(data[0], data[1])
      },
      { concurrency: (/^http/.test(this.input)) ? 1 : 64 }
    )
    debug(result)

    // combine images together to make tile
    let inputFiles = [];
    let streams = [];
    let layouts = [];
    for (var i=0; i<this.tileCount; i++) {
      inputFiles.push(`${this.tmpDir}/prevvy_intermediate${i}.png`);
      streams.push(`[${i}:v]`);
      layouts.push(this.makeLayout(i));
    }
    await this.ffmpegCombineP(inputFiles, streams, layouts);

    return {
      output: this.output
    }


    // /usr/bin/ffmpeg -y -i ./tmp/intermediate0.png -i ./tmp/intermediate1.png -i ./tmp/intermediate2.png -i ./tmp/intermediate3.png -i ./tmp/intermediate4.png -i ./tmp/intermediate5.png -i ./tmp/intermediate6.png -i ./tmp/intermediate7.png -i ./tmp/intermediate8.png -i ./tmp/intermediate8.png -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v][7:v][8:v]xstack=inputs=9:layout=0_0|0_h0|0_h0+h1|w0_0|w0_h0|w0_h0+h1|w0+w3_0|w0+w3_h0|w0+w3_h0+h1[v]" -map [v] output.png
  }
}




module.exports = Prevvy;
