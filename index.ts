import ffmpeg from 'fluent-ffmpeg';
import { Duration } from 'luxon';
import os from 'os';
import path from 'path';
import debug$0 from 'debug';
import { execa } from 'execa';
import fs from 'fs';
import EventEmitter from 'events';

interface IPrevvyProps {
    input: string;
    output: string;
    cols: number;
    rows: number;
    width: number;
    throttleTimeout?: number;
}

class Prevvy extends EventEmitter {
    private tmpDir: string;
    private input: string;
    private output: string;
    private cols: number;
    private rows: number;
    private width: number;
    private tileCount: number;
    private throttleTimeout: number;
    private debug: debug$0.Debugger;
    private durationCacheFile: string;

    constructor({
        input,
        output,
        cols,
        rows,
        width,
        throttleTimeout = 100,
    }: IPrevvyProps) {
        super();
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


    /**
     * 
     * ffmpegSeekP
     * 
     * seeks to a timestamp of a video and returns a single frame
     * 
     * @param {*} timestamp 
     * @param {*} outputFilename 
     * @returns 
     */
    async ffmpegSeekP(timestamp: string, outputFilename: string): Promise<string> {
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
                .on('start', (cmd: string) => {
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

    }




    async getVideoDurationInSeconds(videoFilePath: string) {
        if (!videoFilePath) throw new Error('videoFilePath passed to getVideoDurationInSeconds is undefined');

        // Check if the duration is cached
        if (fs.existsSync(this.durationCacheFile)) {
            const cachedDuration = parseFloat(fs.readFileSync(this.durationCacheFile, 'utf8'));
            this.debug(`Using cached duration: ${cachedDuration} seconds`);
            return cachedDuration;
        }

        // Fetch and cache the duration
        this.debug(`> fetch and cache the video duration using ffprobe. videoFilePath=${videoFilePath}`);
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
        this.debug('Generate a unique ID based on the output filename')
        const id = this.generateFrameId(this.output);
        this.debug(`Generated ID: ${id}`);


        this.debug('Get the duration of the video')
        const durationS = await this.getVideoDurationInSeconds(this.input);
        this.debug(`Video duration: ${durationS} seconds`);

        this.debug('Calculate the slice duration')
        const msSlice = Math.floor((durationS * 1000) / this.tileCount);
        this.debug(`Slice duration: ${msSlice} ms`);

        this.debug('Create frame data')
        const frameData = Array.from({ length: this.tileCount }, (_, i) => {
            // Calculate the timestamp for seeking
            const timestamp = Duration.fromMillis(i * msSlice).toFormat('h:m:s');
            const intermediateOutput = path.join(this.tmpDir, `${id}_${i}.png`);
            return [timestamp, intermediateOutput];
        });

        this.debug(frameData)
        
        const results = [];
        for (const [index, data] of frameData.entries()) {
            if (!data) throw new Error(`frameData entry ${index} was lacking data.`);
            if (!data[0]) throw new Error(`frameData entry data[0] was undefined`);
            if (!data[1]) throw new Error(`frameData entry data[1] was undefined`);
            const x = Math.round((index / frameData.length) * 100); // Calculate the percentage
            this.debug(`Emitting progress percentage ${x} (${index}/${frameData.length})`);
            this.emit('progress', { percentage: x });

            const result = await this.ffmpegSeekP(data[0], data[1]);
            results.push(result);
        }



        // Combining images together to make a tile
        const inputFiles = frameData.map((data, i) => `${this.tmpDir}/${id}_${i}.png`);
        const streams = Array.from({ length: this.tileCount }, (_, i) => `[${i}:v]`);
        const layouts = Array.from({ length: this.tileCount }, (_, i) => this.makeLayout(i));

        await this.ffmpegCombineP(inputFiles, streams, layouts);

        return {
            output: this.output,
        };
    }


    generateFrameId(outputFilename: string) {
        // Generate a unique ID based on the output filename
        const id = path.basename(outputFilename, path.extname(outputFilename));
        return id;
    }

    makeLayout(i: number) {
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

    /**
     * ffmpegCombineP
     * 
     * combines the individual frames into a mosaic
     * 
     * @param {*} inputFiles 
     * @param {*} streams 
     * @param {*} layouts 
     * @returns 
     */
    async ffmpegCombineP(inputFiles: string[], streams: string[], layouts: string[]): Promise<void> {
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
                    this.emit('progress', { percentage: 100 });
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
