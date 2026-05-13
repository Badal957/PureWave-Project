# PureWave Web Extractor (Resonance & Vision)

PureWave is a high-end, studio-quality web extraction tool built with React. It allows users to extract lossless audio and high-definition video from URLs, featuring a custom-built, highly interactive media player with real-time waveform visualization.

## 🚀 Features

### Core Extraction Engine
* **Dual Engine Setup:** Toggle smoothly between Audio Mode (PureWave Resonance) and Video Mode (PureWave Vision).
* **Format Selection:** 
  * Audio: MP3 (320kbps), FLAC (Lossless), WAV (Raw).
  * Video: MP4 from 480p up to 4K (2160p).
* **Playlist Automation:** Automatically parses playlist links and queues multiple tracks for sequential downloading.
* **Auto-Embed Metadata:** Automatically injects ID3 tags and Album Art into downloaded audio files.
* **Real-time Progress:** Live progress tracking via WebSocket (`socket.io`), displaying exact extraction percentages.

### Advanced UI / UX
* **Matrix Rain Engine:** A custom HTML5 Canvas background rendering a subtle, cinematic Matrix digital rain effect.
* **Premium Waveform Player (`wavesurfer.js`):**
  * **4-Color Dynamic Gradient:** The played portion of the audio smoothly transitions from Neon Red -> Deep Purple -> Ocean Cyan -> PureWave Green.
  * **Native CSS Reflection:** Utilizes `-webkit-box-reflect` for a flawless, lag-free mirror reflection of the audio wave.
  * **Transparent Glass Hover:** Uses `mix-blend-mode: overlay` to create a perfect transparent hover shade that only highlights the waveform bars without painting over the background.
  * **Dynamic Timer Badge:** The current timestamp background color dynamically updates frame-by-frame to match the exact gradient color of the wave it sits above.
* **Local Library:** Stores recent extraction history using `localStorage`, displaying track titles, artists, and thumbnails.

## 🛠️ Tech Stack

* **Frontend Framework:** React (Hooks: `useState`, `useEffect`, `useRef`)
* **Icons:** `lucide-react`
* **Audio Visualization:** `wavesurfer.js`
* **WebSockets:** `socket.io-client`
* **Styling:** Pure CSS (Custom glow effects, flexbox layouts, blend-modes)

## 📦 Installation & Setup

### 1. Setup the Frontend
Clone the repository and navigate to the frontend folder.

```bash
# Install dependencies
npm install

# Start the development server
npm run dev






2. Connect the Backend

Ensure your backend extraction server is running on http://localhost:5000.
The frontend expects the following REST and WebSocket endpoints:

    GET /info?url=... - Fetches media metadata (title, artist, thumbnail).

    GET /playlist?url=... - Fetches an array of track URLs from a playlist.

    GET /download?url=...&format=...&mode=...&clientId=... - Initiates the media download.

    Socket.IO event: 'progress' - Emits { percent: number } for the progress bar.

🎨 Visual Assets & Design Details

    Background Orbs: Uses absolute positioning with CSS blur (filter: blur(100px)) to create the atmospheric green and blue glowing lights.

    Logo: A live SVG pulse-line recreating a heartbeat/audio wave monitor.

    Typography & Gradients: Utilizes linear gradients on text spans (text-gradient-audio, text-gradient-video) to shift branding colors instantly when the user toggles modes.

⚠️ Disclaimer

PureWave is a media extraction tool intended strictly for personal archiving and downloading content for which you possess the copyright or explicit permission. Do not use this tool to distribute unauthorized copyrighted material.