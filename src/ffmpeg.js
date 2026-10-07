import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

const CDN = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
let ffmpegInstance = null;
let loadPromise = null;

export async function loadFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => {
      if (onProgress && /time=/.test(message)) onProgress(message);
    });

    await ffmpeg.load({
      coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm')
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadPromise;
}

export { fetchFile };
