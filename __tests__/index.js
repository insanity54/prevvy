import Prevvy from "../index.ts";
import * as generatePreview from "ffmpeg-generate-video-preview";
import path from "path";
import fs from "fs";
import os from "os";
const testVideoPath = path.join(__dirname, 'video.mp4');
const testImageDir = __dirname;
const testImage3x3Path = path.join(__dirname, 'testImage3x3.png');
const testImage6x3Path = path.join(__dirname, 'testImage6x3.png');
const movieUrl = 'https://ipfs.io/ipfs/QmQWM1qDPasxm5sXAQeVMfmhnECBzyYkLgfK23yPif1Ftx'; // Blender Half full. Source-- https://ipfs.video/
const opts = (id) => {
    return {
        input: testVideoPath,
        output: path.join(testImageDir, `testImage_${id}.png`),
        width: 256,
        cols: 3,
        rows: 3
    };
};
const assertTestVideoExistence = () => {
    return new Promise((resolve, reject) => {
        fs.stat(testVideoPath, (err, stats) => {
            if (typeof stats === 'undefined') {
                reject("The test videos don\'t exist. Please run 'pn run assets' to fetch them.");
            }
            else {
                resolve();
            }
        });
    });
};
describe('prevvy', () => {
    jest.setTimeout(10000);
    beforeAll(() => {
        return assertTestVideoExistence();
    });
    xdescribe('sanity', () => {
        it('should give human-readable format if ffprobe does not exist/is not accessible in the running environment', async () => {
            jest.mock('ffprobe', () => {
                return jest.fn(() => 42);
            });
            const p = new Prevvy();
            await expect(p.ffprobeP('video.mp4')).to.throw(/environment/);
        });
    });
    describe('perf', () => {
        xit('should generate an image faster than ffmpeg-generate-video-preview', async () => {
            // this fails on videos of lower file size, but I think it will succeed on videos that are several GB in size.
            // There are complications getting a large filesize video to test (my internet sucks)
            let prevvyStartTime = new Date().valueOf();
            let p = new Prevvy(opts('prevvy'));
            await p.generate();
            let prevvyEndTime = new Date().valueOf();
            let prevvyElapsedTime = prevvyEndTime - prevvyStartTime;
            console.log(`prevvy took ${prevvyElapsedTime}ms`);
            let fgvpStartTime = new Date().valueOf();
            await generatePreview(opts('fgvp'));
            let fgvpEndTime = new Date().valueOf();
            let fgvpElapsedTime = fgvpEndTime - fgvpStartTime;
            console.log(`fgvp took ${fgvpElapsedTime}ms`);
            expect(prevvyElapsedTime).toBeLessThan(fgvpElapsedTime);
        });
    });
    describe('generate', () => {
        test('http input source', () => {
            const opts = {
                input: movieUrl,
                output: path.join(os.tmpdir(), 'test.png'),
                cols: 3,
                rows: 3,
                width: 42,
                throttleTimeout: 10000
            };
            let p = new Prevvy(opts);
            return p.generate();
        }, 120000);
        test('should cope with a video with spaces and special characters in its name', () => {
            const opts = {
                input: path.join(__dirname, 'test vid (spaces).mp4'),
                output: path.join(__dirname, 'spacesOutput.png'),
                cols: 3,
                rows: 3,
                width: 42
            };
        });
        test('should make a 3x3 preview image', () => {
            const opts = {
                input: testVideoPath,
                output: testImage3x3Path,
                cols: 3,
                rows: 3,
                width: 256
            };
            let p = new Prevvy(opts);
            return p.generate();
        });
        test('should make a 6x3 preview image', () => {
            const opts = {
                input: testVideoPath,
                output: testImage6x3Path,
                cols: 6,
                rows: 3,
                width: 128
            };
            let p = new Prevvy(opts);
            return p.generate();
        });
    });
    describe('makeLayout', () => {
        let p;
        
        beforeEach(() => {
            p = new Prevvy(opts('layout'));
        });
        test('3x3 grid i 0', () => {
            expect(p.makeLayout(0)).toBe('0_0');
        });
        test('3x3 grid i 1', () => {
            expect(p.makeLayout(1)).toBe('w0_0');
        });
        test('3x3 grid i 2', () => {
            expect(p.makeLayout(2)).toBe('w0+w0_0');
        });
        test('3x3 grid i 3', () => {
            expect(p.makeLayout(3)).toBe('0_h0');
        });
        test('3x3 grid i 4', () => {
            expect(p.makeLayout(4)).toBe('w0_h0');
        });
        test('3x3 grid i 5', () => {
            expect(p.makeLayout(5)).toBe('w0+w0_h0');
        });
        test('3x3 grid i 6', () => {
            expect(p.makeLayout(6)).toBe('0_h0+h0');
        });
        test('3x3 grid i 7', () => {
            expect(p.makeLayout(7)).toBe('w0_h0+h0');
        });
        test('3x3 grid i 8', () => {
            expect(p.makeLayout(8)).toBe('w0+w0_h0+h0');
        });
    });
});
