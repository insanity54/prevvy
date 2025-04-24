# prevvy

**DEPRECATED**
https://github.com/amietn/vcsi
**DEPRECATED**

**DEPRECATED**

**Don't use this. It's really slow. use https://github.com/amietn/vcsi instead**

[![insanity54](https://circleci.com/gh/insanity54/prevvy.svg?style=svg)](https://app.circleci.com/pipelines/github/insanity54/prevvy)


Create a tiled video preview image using ffmpeg... FAST!

## Motivation

FFmpeg has this capability built in...

```
ffmpeg -i ./example.mp4 -y -vframes 1 -q:v 2 -vf 'select=not(mod(n\,23744)),scale=160:-1,tile=6x5:color=Black' output.jpg
```

... but for long videos, it is **very** slow. This is because ffmpeg must process every frame in the video, a task that is not well suited for microinstances in datacenters.

This module is designed to accomplish the job of getting a tiled screenshot image FAST, by calling ffmpeg multiple times in parallel, each time using ffmpeg's [Input Seeking](https://trac.ffmpeg.org/wiki/Seeking) feature to seek to a point in the video, take a 1 frame snapshot, before combining all the snapshots together (again with ffmpeg) to form a tiled image of snapshots.

## Example Output

![Image Output Example](https://raw.githubusercontent.com/insanity54/prevvy/main/example-image.png)

## Caveats

  * This project addresses speed for large (several GB) videos only. On small size videos, this module is potentially slower than using FFmpeg's tile filter.
  * Frame selection accuracy is not a priority. In other words, the frames selected to be combined into the output are not going to be the same frames that ffmpeg would have chosen, given the same options.

## API Usage

```ts
  const videoPath = '/tmp/input.mp4'
  const imagePath = '/tmp/output.png';

  let options = {
    input: videoPath,
    output: imagePath,
    width: 128,
    cols: 6,
    rows: 3
  };

  let prevvy = new Prevvy(options);

  /**
   * Optional: the prevvy instance extends EventEmitter, emitting progress events.
   */
  prevvy.on('progress', async (data: { percentage: number }) => {
    await job.updateProgress(data.percentage);
  });

  await prevvy.generate();
```

## CLI Usage

```
DEBUG=prevvy node ./cli.js generate --input 'https://example.com/my-video.mp4' --output ./my-storyboard.png
```
