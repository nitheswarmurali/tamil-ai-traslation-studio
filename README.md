# Tamil Voice Studio

Translate any English video into Tamil voice-over — 100% in the browser, deployable on Vercel.

## Features
- Upload file or paste URL (YouTube, Facebook, Instagram, etc. via direct MP4)
- Client-side ffmpeg.wasm for audio extraction & merging
- Web Speech API + Whisper fallback for transcription
- MyMemory translation API
- Microsoft Edge TTS for Tamil voice
- Download final video with Tamil audio

## Local dev
```bash
npm install
npm run dev
# → http://localhost:5173
```

## Deploy to Vercel
```bash
npm i -g vercel
vercel
# Follow prompts. Done.
```

Or connect the GitHub repo to Vercel dashboard.

## Environment variables
- `HF_TOKEN` (optional) — Hugging Face token for Whisper transcription
- `TTS_VOICE` (optional) — override Tamil voice, default `ta-IN-PallaviNeural`

## How it works
1. Video stays in browser
2. ffmpeg.wasm extracts audio → 16kHz mono WAV
3. WAV split into 25s chunks → sent to `/api/transcribe`
4. English text → `/api/translate` → Tamil
5. Tamil text → `/api/tts` → MP3 audio
6. Segments aligned + merged with original video (ffmpeg.wasm)
7. Download result
