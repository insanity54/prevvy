import ffmpeg from 'fluent-ffmpeg';
import { DateTime, Duration } from 'luxon';
import Promise from 'bluebird';
import os from 'os';
import path from 'path';
import debug$0 from 'debug';
import execa from 'execa';
import fs from 'fs';

class Prevvy {
    constructor({
        input,
        output,
        cols,
        rows,
        width,
        throttleTimeout = 1000,
    }) {
        this.tmpDir = os.tmpdir();
        this.input = input;
        this.output = output;
        this.cols = cols;
        this.rows = rows;
        this.width = width;
        this.tileCount = this.rows * this.cols;
        this.throttleTimeout = throttleTimeout;
        this.debug = debug$0('prevvy');
        this.durationCacheFile = `${this.output}.duration`;
    }
    async ffmpegSeekP(timestamp, outputFilename) {
        try {
            // Check if the frame already exists on disk
            if (fs.existsSync(outputFilename)) {
                this.debug(`Frame at timestamp ${timestamp} already exists. Skipping frame generation.`);
                return outputFilename;
            }

            return new Promise((resolve, reject) => {
                ffmpeg()
                    .addOption('-ss', timestamp)
                    .addOption('-i', this.input)
                    .addOption('-frames:v', '1')
                    .on('start', (cmd) => {
                        this.debug(`ffmpegSeekP spawned ffmpeg: ${cmd}`);
                    })
                    .on('end', () => {
                        this.debug('throttle for HTTP requests.')
                        setTimeout(() => {
                            this.debug('throttle complete')
                            resolve(outputFilename);
                        }, this.throttleTimeout);
                    })
                    .on('error', (e) => {
                        this.debug(`Error during ffmpegSeekP: ${e.message}`);
                        reject(e);
                    })
                    .save(outputFilename);
            });
        } catch (error) {
            this.debug(`Error in ffmpegSeekP: ${error.message}`);
            throw error;
        }
    }




    async getVideoDurationInSeconds(videoFilePath) {
        // Check if the duration is cached
        if (fs.existsSync(this.durationCacheFile)) {
            const cachedDuration = parseFloat(fs.readFileSync(this.durationCacheFile, 'utf8'));
            this.debug(`Using cached duration: ${cachedDuration} seconds`);
            return cachedDuration;
        }

        // Fetch and cache the duration
        const { stdout } = await execa('ffprobe', ['-v', 'error', '-show_format', '-show_streams', videoFilePath]);
        const matched = stdout.match(/duration="?(\d*\.\d*)"?/);
        if (matched && matched[1]) {
            const duration = parseFloat(matched[1]);
            // Cache the duration
            fs.writeFileSync(this.durationCacheFile, duration.toString(), 'utf8');
            this.debug(`Fetched and cached duration: ${duration} seconds`);
            return duration;
        } else {
            throw new Error('Unable to fetch video duration.');
        }
    }


    async generate() {
        try {
            this.debug('Generate a unique ID based on the output filename')
            const id = this.generateFrameId(this.output);
            this.debug(`Generated ID: ${id}`);


            this.debug('Get the duration of the video')
            const durationS = await this.getVideoDurationInSeconds(this.input);
            this.debug(`Video duration: ${durationS} seconds`);

            this.debug('Calculate the slice duration')
            const msSlice = parseInt((durationS * 1000) / this.tileCount);
            this.debug(`Slice duration: ${msSlice} ms`);

            this.debug('Create frame data')
            const frameData = Array.from({ length: this.tileCount }, (_, i) => {
                // Calculate the timestamp for seeking
                const timestamp = Duration.fromMillis(i * msSlice).toFormat('h:m:s');
                const intermediateOutput = path.join(this.tmpDir, `${id}_${i}.png`);
                return [timestamp, intermediateOutput];
            });

            this.debug(frameData)

            const concurrency = /^http/.test(this.input) ? 1 : 64

            const result = await Promise.map(
                frameData,
                async (data) => await this.ffmpegSeekP(data[0], data[1]),
                { concurrency: concurrency }
            );
            this.debug(`Throttle HTTP requests (concurrency ${concurrency})`)
            this.debug(`Frame generation result: ${result}`);

            // Combining images together to make a tile
            const inputFiles = frameData.map((data, i) => `${this.tmpDir}/${id}_${i}.png`);
            const streams = Array.from({ length: this.tileCount }, (_, i) => `[${i}:v]`);
            const layouts = Array.from({ length: this.tileCount }, (_, i) => this.makeLayout(i));

            await this.ffmpegCombineP(inputFiles, streams, layouts);

            return {
                output: this.output,
            };
        } catch (error) {
            this.debug(`Error: ${error.message}`);
            throw error;
        }
    }


    generateFrameId(outputFilename) {
        // Generate a unique ID based on the output filename
        const id = path.basename(outputFilename, path.extname(outputFilename));
        return id;
    }

    makeLayout(i) {
        // see https://ffmpeg.org/ffmpeg-filters.html#xstack for the madness
        const currentColumn = i % this.cols;
        const currentRow = Math.floor(i / this.cols);
        let colSide = [];
        let rowSide = [];
        if (currentColumn === 0) {
            colSide.push('0');
        }
        else {
            for (var j = 0; j < currentColumn; j++) {
                colSide.push('w0');
            }
        }
        if (currentRow === 0) {
            rowSide.push('0');
        }
        else {
            for (var j = 0; j < currentRow; j++) {
                rowSide.push('h0');
            }
        }
        return `${colSide.join('+')}_${rowSide.join('+')}`;
    }

    // makeLayout(i) {
    //     // Calculate layout based on column and row
    //     const currentColumn = i % this.cols;
    //     const currentRow = Math.floor(i / this.cols);
      
    //     let colSide = [];
    //     let rowSide = [];
      
    //     if (currentColumn === 0) {
    //       colSide.push('0');
    //     } else {
    //       for (var j = 0; j < currentColumn; j++) {
    //         colSide.push(`w${j}`);
    //       }
    //     }
      
    //     if (currentRow === 0) {
    //       rowSide.push('0');
    //     } else {
    //       for (var j = 0; j < currentRow; j++) {
    //         rowSide.push(`h${j}`);
    //       }
    //     }
      
    //     return `${colSide.join('+')}|${rowSide.join('+')}`;
    //   }
      


    async ffmpegCombineP(inputFiles, streams, layouts) {
        return new Promise((resolve, reject) => {
            const command = ffmpeg();

            this.debug('Add input files')
            inputFiles.forEach((inputFile) => {
                this.debug(`inputFile:${inputFile}`)
                command.input(inputFile);
            });

            this.debug('Add ffmpeg options for combining')
            command
                .addOption('-y')  // Overwrite output files if they exist
                .addOption('-filter_complex', `${streams.join('')}xstack=inputs=${inputFiles.length}:layout=${layouts.join('|')}[v];[v]scale=${Math.floor(this.width * this.cols)}:-1[scaled]`)
                .addOption('-map', '[scaled]') // Map the scaled output

                .on('start', (cmd) => this.debug(`ffmpegCombineP: ${cmd}`))
                .on('end', () => {
                    resolve();
                })
                .on('error', (e) => {
                    this.debug(`Error during ffmpegCombineP: ${e.message}`);
                    reject(e);
                })
                .save(this.output); // Save the combined output
        });
    }

}

export default Prevvy;
