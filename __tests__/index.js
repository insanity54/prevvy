const Prevvy = require('../index');
const path = require('path');
const testVideoPath = path.join(__dirname, 'testVideo.mp4');
const testImage3x3Path = path.join(__dirname, 'testImage3x3.png');
const testImage6x3Path = path.join(__dirname, 'testImage6x3.png');

const opts1 = {
  input: testVideoPath,
  output: testImage3x3Path,
  width: 256,
  cols: 3,
  rows: 3
}

describe('prevvy', () => {
  jest.setTimeout(10000);
  describe('generate', () => {
    xit('should throw if not receiving params', () => {

    })
    xit('should generate an image faster than ffmpeg-generate-video-preview', () => {

    })
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
      p = new Prevvy(opts1);
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
