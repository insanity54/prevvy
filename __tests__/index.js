const prevvy = require('../index');
const path = require('path');
const testVideoPath = path.join(__dirname, 'testVideo.mp4');
const testImagePath = path.join(__dirname, 'testImage.jpg');

describe('prevvy', () => {
  xit('should throw if not receiving params', () => {

  })
  xit('should generate an image faster than ffmpeg-generate-video-preview')
  it('should be a good boy', async () => {
    const opts = {
      input: testVideoPath,
      output: testImagePath,
      cols: 6,
      rows: 3,
      width: 256
    }
    await prevvy(opts)
  })
});
