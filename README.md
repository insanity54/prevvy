# prevvy

Create a tiled video preview image using ffmpeg... FAST!

FFmpeg has this capability built in...

```
ffmpeg -i ./example.mp4 -y -vframes 1 -q:v 2 -vf 'select=not(mod(n\,23744)),scale=160:-1,tile=6x5:color=Black' output.jpg
```

... but for long videos, it is **very** slow. This is because ffmpeg must process every frame in the video, a task that is not well suited for microinstances in datacenters.

This module is designed to accomplish the job of getting a tiled screenshot image FAST, by calling ffmpeg multiple times in parallel, each time using ffmpeg's [Input Seeking](https://trac.ffmpeg.org/wiki/Seeking) feature to seek to a point in the video, take a 1 frame snapshot, before combining all the snapshots together to form a tiled image of snapshots.
