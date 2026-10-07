import { loadFFmpeg, fetchFile } from './ffmpeg.js';

const CHUNK_SECONDS = 25;

function setStatus(text) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = text;
}

function setProgress(p) {
  const el = document.getElementById('fill');
  if (el) el.style.width = p + '%';

  const cur = p < 8 ? 1 : p < 40 ? 2 : p < 62 ? 3 : p < 90 ? 4 : p < 100 ? 5 : 6;
  for (let i = 1; i <= 5; i++) {
    const step = document.getElementById('st' + i);
    if (!step) continue;
    step.classList.remove('active', 'done');
    if (i < cur) step.classList.add('done');
    else if (i === cur) step.classList.add('active');
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getAudioDuration(wavBlob) {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) throw new Error('Web Audio API unavailable in this browser');

  const audioContext = new AudioCtor();
  try {
    const data = await wavBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(data.slice(0));
    return audioBuffer.duration;
  } finally {
    await audioContext.close();
  }
}

async function postJSON(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${url} → ${r.status}: ${txt.slice(0, 200)}`);
  }

  return r.json();
}

async function postJSONForAudio(url, payload) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`TTS → ${r.status}: ${txt.slice(0, 200)}`);
  }

  return r.blob();
}

export async function runPipeline({ file, url }) {
  const prog = document.getElementById('prog');
  const success = document.getElementById('success');
  const err = document.getElementById('err');
  const errMsg = document.getElementById('errMsg');
  const goBtn = document.getElementById('go');

  prog.classList.add('show');
  success.classList.remove('show');
  err.classList.remove('show');

  try {
    setProgress(3);
    setStatus('Loading ffmpeg…');
    const ffmpeg = await loadFFmpeg();

    let inputName = 'input.mp4';
    let inputData;

    if (file) {
      inputData = await fetchFile(file);
      inputName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'input.mp4';
    } else if (url) {
      setStatus('Downloading from URL…');
      const response = await fetch('/api/proxy?url=' + encodeURIComponent(url));
      if (!response.ok) throw new Error('Failed to download URL: ' + response.status);
      const blob = await response.blob();
      inputData = new Uint8Array(await blob.arrayBuffer());
      inputName = 'input.mp4';
    } else {
      throw new Error('No input');
    }

    setProgress(8);
    setStatus('Extracting audio…');
    await ffmpeg.writeFile(inputName, inputData);
    await ffmpeg.exec(['-y', '-i', inputName, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', 'audio.wav']);

    const wavData = await ffmpeg.readFile('audio.wav');
    const wavBlob = new Blob([wavData.buffer], { type: 'audio/wav' });

    setProgress(12);
    setStatus('Splitting audio into chunks…');

    const totalSec = await getAudioDuration(wavBlob);
    const numChunks = Math.max(1, Math.ceil(totalSec / CHUNK_SECONDS));
    const chunkBlobs = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK_SECONDS;
      const chunkName = `chunk_${i}.wav`;
      await ffmpeg.exec([
        '-y', '-i', 'audio.wav',
        '-ss', String(start),
        '-t', String(CHUNK_SECONDS),
        '-ac', '1',
        '-ar', '16000',
        chunkName
      ]);
      const data = await ffmpeg.readFile(chunkName);
      chunkBlobs.push(new Blob([data.buffer], { type: 'audio/wav' }));
      await ffmpeg.deleteFile(chunkName).catch(() => {});
    }

    setProgress(20);
    setStatus(`Transcribing ${numChunks} chunks…`);

    const transcripts = new Array(numChunks).fill('');
    let done = 0;
    const concurrency = 3;
    const queue = chunkBlobs.map((blob, idx) => ({ blob, idx }));

    async function worker() {
      while (queue.length) {
        const job = queue.shift();
        if (!job) break;
        try {
          const b64 = await blobToBase64(job.blob);
          const result = await postJSON('/api/transcribe', { audioBase64: b64 });
          transcripts[job.idx] = result.text || '';
        } catch (error) {
          console.warn(`Chunk ${job.idx} failed:`, error.message);
          transcripts[job.idx] = '';
        }
        done += 1;
        setProgress(20 + Math.round(20 * (done / numChunks)));
        setStatus(`Transcribed ${done}/${numChunks}`);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, worker));

    if (!transcripts.some((t) => t.trim())) {
      throw new Error('No speech detected in video');
    }

    setProgress(45);
    setStatus('Translating to Tamil…');

    const tamil = new Array(numChunks).fill('');
    let tDone = 0;
    const tQueue = transcripts.map((text, i) => ({ text, i })).filter((x) => x.text.trim());

    async function tWorker() {
      while (tQueue.length) {
        const job = tQueue.shift();
        if (!job) break;
        try {
          const result = await postJSON('/api/translate', { text: job.text, from: 'en-US', to: 'ta-IN' });
          tamil[job.i] = result.translated || '';
        } catch (error) {
          console.warn(`Translate ${job.i} failed:`, error.message);
        }
        tDone += 1;
        setProgress(45 + Math.round(15 * (tDone / Math.max(1, transcripts.length))));
        setStatus(`Translated ${tDone}/${transcripts.length}`);
      }
    }

    await Promise.all(Array.from({ length: 3 }, tWorker));

    setProgress(62);
    setStatus('Generating Tamil voice…');

    const audioSegments = new Array(numChunks).fill(null);
    let aDone = 0;
    const aQueue = tamil.map((text, i) => ({ text, i })).filter((x) => x.text.trim());

    async function aWorker() {
      while (aQueue.length) {
        const job = aQueue.shift();
        if (!job) break;
        try {
          const blob = await postJSONForAudio('/api/tts', { text: job.text });
          audioSegments[job.i] = blob;
        } catch (error) {
          console.warn(`TTS ${job.i} failed:`, error.message);
        }
        aDone += 1;
        setProgress(62 + Math.round(20 * (aDone / Math.max(1, tamil.length))));
        setStatus(`Voice ${aDone}/${tamil.length}`);
      }
    }

    await Promise.all(Array.from({ length: 4 }, aWorker));

    if (!audioSegments.some(Boolean)) {
      throw new Error('Tamil voice generation failed');
    }

    setProgress(85);
    setStatus('Assembling Tamil audio…');

    const segmentFiles = [];
    for (let i = 0; i < numChunks; i++) {
      const wavName = `al_${i}.wav`;
      const mp3Name = `t_${i}.mp3`;

      if (audioSegments[i]) {
        const buffer = new Uint8Array(await audioSegments[i].arrayBuffer());
        await ffmpeg.writeFile(mp3Name, buffer);
        try {
          await ffmpeg.exec([
            '-y', '-i', mp3Name,
            '-af', `apad=whole_dur=${CHUNK_SECONDS}`,
            '-ar', '22050',
            '-ac', '1',
            '-t', String(CHUNK_SECONDS),
            wavName
          ]);
        } catch {
          await ffmpeg.exec([
            '-y', '-f', 'lavfi', '-i', `anullsrc=r=22050:cl=mono:d=${CHUNK_SECONDS}`,
            '-t', String(CHUNK_SECONDS),
            wavName
          ]);
        }
      } else {
        await ffmpeg.exec([
          '-y', '-f', 'lavfi', '-i', `anullsrc=r=22050:cl=mono:d=${CHUNK_SECONDS}`,
          '-t', String(CHUNK_SECONDS),
          wavName
        ]);
      }

      segmentFiles.push(wavName);
    }

    const listContent = segmentFiles.map((f) => `file '${f}'`).join('\n');
    await ffmpeg.writeFile('list.txt', new TextEncoder().encode(listContent));
    await ffmpeg.exec(['-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', 'tamil_audio.wav']);

    await ffmpeg.exec(['-y', '-i', 'tamil_audio.wav', '-b:a', '128k', 'tamil_voice.mp3']);
    const mp3Data = await ffmpeg.readFile('tamil_voice.mp3');
    const mp3Blob = new Blob([mp3Data.buffer], { type: 'audio/mpeg' });
    const mp3Url = URL.createObjectURL(mp3Blob);

    setProgress(94);
    setStatus('Merging with video…');

    await ffmpeg.exec([
      '-y',
      '-i', inputName,
      '-i', 'tamil_audio.wav',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      'output.mp4'
    ]);

    const outData = await ffmpeg.readFile('output.mp4');
    const outBlob = new Blob([outData.buffer], { type: 'video/mp4' });
    const outUrl = URL.createObjectURL(outBlob);

    const dl = document.getElementById('dl');
    dl.href = outUrl;
    dl.download = 'tamil_video.mp4';

    const a = document.createElement('a');
    a.href = mp3Url;
    a.download = 'tamil_voice.mp3';
    a.click();

    setProgress(100);
    setStatus('Complete');
    document.getElementById('success').classList.add('show');
    goBtn.disabled = false;
    goBtn.classList.remove('loading');
  } catch (error) {
    console.error(error);
    errMsg.textContent = error.message || String(error);
    err.classList.add('show');
    goBtn.disabled = false;
    goBtn.classList.remove('loading');
  }
}
