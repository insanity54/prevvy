import { describe, beforeAll, beforeEach, test } from 'vitest';
import { expect } from 'chai';
import Prevvy, { IPrevvyOptions } from './index.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { dirname } from 'path';
import { fileURLToPath } from 'url';


const __dirname = dirname(fileURLToPath(import.meta.url));
const testVideoPath = path.join(__dirname, 'fixtures', 'video.mp4');
const testImageDir = __dirname;
const testImage3x3Path = path.join(__dirname, 'fixtures', 'testImage3x3.png');
const testImage6x3Path = path.join(__dirname, 'fixtures', 'testImage6x3.png');
const movieUrl = 'https://ipfs.io/ipfs/QmQWM1qDPasxm5sXAQeVMfmhnECBzyYkLgfK23yPif1Ftx';

const opts = (id: string): IPrevvyOptions => {
  return {
    input: testVideoPath,
    output: path.join(testImageDir, `testImage_${id}.png`),
    width: 256,
    cols: 3,
    rows: 3,
  };
};

const assertTestVideoExistence = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    fs.stat(testVideoPath, (err, stats) => {
      if (typeof stats === 'undefined') {
        reject("The test videos don\'t exist. Please run 'pn run assets' to fetch them.");
      } else {
        resolve();
      }
    });
  });
};

describe('prevvy', () => {
  beforeAll(async () => {
    await assertTestVideoExistence();
  });



  describe('generate', function() {
    
    test('http input source', async () => {
      const options: IPrevvyOptions = {
        input: movieUrl,
        output: path.join(os.tmpdir(), 'test.png'),
        cols: 3,
        rows: 3,
        width: 42,
        throttleTimeout: 10000,
      };
      let p = new Prevvy(options);
      await p.generate();
    }, 120000)

    test('should cope with a video with spaces and special characters in its name', () => {
      const options: IPrevvyOptions = {
        input: path.join(__dirname, 'test vid (spaces).mp4'),
        output: path.join(__dirname, 'spacesOutput.png'),
        cols: 3,
        rows: 3,
        width: 42,
      };
    });

    test('should make a 3x3 preview image', async () => {
      const options: IPrevvyOptions = {
        input: testVideoPath,
        output: testImage3x3Path,
        cols: 3,
        rows: 3,
        width: 256,
      };
      let p: Prevvy = new Prevvy(options);
      await p.generate();
    });

    test('should make a 6x3 preview image', async () => {
      const options: IPrevvyOptions = {
        input: testVideoPath,
        output: testImage6x3Path,
        cols: 6,
        rows: 3,
        width: 128,
      };
      let p = new Prevvy(options);
      await p.generate();
    }, 6000);
  });

  describe('makeLayout', () => {
    let p: Prevvy;

    beforeEach(() => {
      p = new Prevvy(opts('layout'));
    });

    test('3x3 grid i 0', () => {
      expect(p.makeLayout(0)).to.equal('0_0');
    });

    test('3x3 grid i 1', () => {
      expect(p.makeLayout(1)).to.equal('w0_0');
    });

    test('3x3 grid i 2', () => {
      expect(p.makeLayout(2)).to.equal('w0+w0_0');
    });

    test('3x3 grid i 3', () => {
      expect(p.makeLayout(3)).to.equal('0_h0');
    });

    test('3x3 grid i 4', () => {
      expect(p.makeLayout(4)).to.equal('w0_h0');
    });

    test('3x3 grid i 5', () => {
      expect(p.makeLayout(5)).to.equal('w0+w0_h0');
    });

    test('3x3 grid i 6', () => {
      expect(p.makeLayout(6)).to.equal('0_h0+h0');
    });

    test('3x3 grid i 7', () => {
      expect(p.makeLayout(7)).to.equal('w0_h0+h0');
    });

    test('3x3 grid i 8', () => {
      expect(p.makeLayout(8)).to.equal('w0+w0_h0+h0');
    });
  });
});
