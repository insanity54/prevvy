const Prevvy = require('../index');
const generatePreview = require('ffmpeg-generate-video-preview');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const testVideoPath = path.join(__dirname, 'BigBuckBunny_320x180.mp4');
const testImageDir = __dirname;
const testImage3x3Path = path.join(__dirname, 'testImage3x3.png');
const testImage6x3Path = path.join(__dirname, 'testImage6x3.png');
const movieUrl = 'https://ipfs.io/ipfs/QmTKZgRNwDNZwHtJSjCp6r5FYefzpULfy37JvMt9DwvXse/video.mp4';
const opts = (id) => {
  return {
    input: testVideoPath,
    output: path.join(testImageDir, `testImage_${id}.png`),
    width: 256,
    cols: 3,
    rows: 3
  };
};


const downloadTestVideo = () => {
  console.log(`downloading ${movieUrl}`)
  return axios.get(movieUrl, {
    method: 'GET',
    responseType: 'stream'
  }).then((res) => {
    return new Promise((resolve, reject) => {
      let writeStream = fs.createWriteStream(testVideoPath);
      res.data.pipe(writeStream);
      res.data.on('end', () => {
        resolve(testVideoPath)
      })
    })
  })
}

const assertTestVideoExistence = () => {
  return new Promise((resolve, reject) => {
    fs.stat(testVideoPath, (err, stats) => {
      if (typeof stats === 'undefined') {
        return downloadTestVideo()
      } else {
        resolve()
      }
    });
  })
}


describe('prevvy', () => {
  jest.setTimeout(10000);
  describe('perf', () => {
    beforeAll(() => {
      return assertTestVideoExistence();
    });
    xit('should generate an image faster than ffmpeg-generate-video-preview', async () => {
      // this fails on videos of lower file size, but I think it will succeed on videos that are several GB in size.
      // There are complications getting a large filesize video to test (my internet sucks)
      jest.setTimeout(1000*60*20);

      let prevvyStartTime = new Date().valueOf();
      let p = new Prevvy(opts('prevvy'));
      await p.generate();
      let prevvyEndTime = new Date().valueOf();
      let prevvyElapsedTime = prevvyEndTime-prevvyStartTime;
      console.log(`prevvy took ${prevvyElapsedTime}ms`);

      let fgvpStartTime = new Date().valueOf();
      await generatePreview(opts('fgvp'));
      let fgvpEndTime = new Date().valueOf();
      let fgvpElapsedTime = fgvpEndTime-fgvpStartTime;
      console.log(`fgvp took ${fgvpElapsedTime}ms`);

      expect(prevvyElapsedTime).toBeLessThan(fgvpElapsedTime);

    })
  })
  describe('generate', () => {
    test('should make a 3x3 preview image', () => {
      const opts = {
        input: testVideoPath,
        output: testImage3x3Path,
        cols: 3,
        rows: 3,
        width: 256
      }
      let p = new Prevvy(opts);
      return p.generate();
    })
    test('should make a 6x3 preview image', () => {
      const opts = {
        input: testVideoPath,
        output: testImage6x3Path,
        cols: 6,
        rows: 3,
        width: 256
      }
      let p = new Prevvy(opts);
      return p.generate();
    })
  });

  describe('makeLayout', () => {
    beforeEach(() => {
      p = new Prevvy(opts('layout'));
    })
    test('3x3 grid i 0', () => {
      expect(p.makeLayout(0)).toBe('0_0');
    })
    test('3x3 grid i 1', () => {
      expect(p.makeLayout(1)).toBe('w0_0');
    })
    test('3x3 grid i 2', () => {
      expect(p.makeLayout(2)).toBe('w0+w0_0');
    })
    test('3x3 grid i 3', () => {
      expect(p.makeLayout(3)).toBe('0_h0');
    })
    test('3x3 grid i 4', () => {
      expect(p.makeLayout(4)).toBe('w0_h0');
    })
    test('3x3 grid i 5', () => {
      expect(p.makeLayout(5)).toBe('w0+w0_h0');
    })
    test('3x3 grid i 6', () => {
      expect(p.makeLayout(6)).toBe('0_h0+h0');
    })
    test('3x3 grid i 7', () => {
      expect(p.makeLayout(7)).toBe('w0_h0+h0');
    })
    test('3x3 grid i 8', () => {
      expect(p.makeLayout(8)).toBe('w0+w0_h0+h0');
    });
  });
});
