const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ytdlp = require('yt-dlp-exec');
const { exec } = require('yt-dlp-exec');
const NodeID3 = require('node-id3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// FFmpeg setup
const ffmpegPath = process.env.NODE_ENV === 'production' ? 'ffmpeg' : require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const cookiePath = path.join(__dirname, 'cookies.txt');

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['Content-Disposition'] 
}));

io.on('connection', (socket) => {
    console.log(`Frontend Connected: ${socket.id}`);
});

// Helper for Base yt-dlp Options (Anti-Bot configuration)
const getBaseOptions = () => ({
    noWarnings: true,
    cookies: '/app/cookies.txt', 
    noCheckCertificates: true,
    preferFreeFormats: true
});

app.get('/info', async (req, res) => {
    try {
        const infoOptions = { 
            dumpSingleJson: true, 
            ...getBaseOptions(),
            format: 'ba/bv/best/all' // Bulletproof format selector
        };

        const info = await ytdlp(req.query.url, infoOptions);
        
        res.json({ 
            title: info.title, 
            videoId: info.id, 
            thumbnail: info.thumbnail, 
            uploader: info.uploader 
        });
    } catch (error) {
        console.error("Info Fetch Error:", error.message);
        res.status(500).json({ 
            error: "Could not fetch info.", 
            exact_cause: error.message || error.toString() 
        });
    }
});

app.get('/playlist', async (req, res) => {
    try {
        const info = await ytdlp(req.query.url, { dumpSingleJson: true, flatPlaylist: true, ...getBaseOptions() });
        const tracks = info.entries.map(entry => entry.url || `https://www.youtube.com/watch?v=${entry.id}`);
        res.json({ title: info.title, tracks: tracks });
    } catch (error) {
        console.error("Playlist Fetch Error:", error.message);
        res.status(500).json({ error: "Could not fetch playlist." });
    }
});

// --- DUAL ENGINE DOWNLOADER (Audio & Video) ---
app.get('/download', async (req, res) => {
    const { url, clientId, format = 'mp3', mode = 'audio' } = req.query; 

    try {
        // 1. Get Video Metadata
        const info = await ytdlp(url, { dumpSingleJson: true, ...getBaseOptions() });
        
        const cleanTitle = info.title.replace(/[^a-zA-Z0-9 ]/g, '');
        const isVideo = mode === 'video';
        const fileExtension = isVideo ? 'mp4' : format;
        
        // THE FIX: Use %(ext)s so yt-dlp manages the conversion extensions correctly
        const tempId = Date.now();
        const ytDlpOutputPath = path.join(__dirname, `temp_${tempId}.%(ext)s`);
        const finalFilePath = path.join(__dirname, `temp_${tempId}.${fileExtension}`);

        // 2. Fetch Thumbnail for Audio ID3 Tags
        let imageBuffer = null;
        if (!isVideo && info.thumbnail) {
            try {
                const imgRes = await axios.get(info.thumbnail, { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (e) {
                console.log("Failed to download thumbnail, continuing without it.");
            }
        }

        // 3. Configure Download Engine (Removed ffmpegLocation so it auto-detects!)
        let dlOptions = { 
            ...getBaseOptions(), 
            output: ytDlpOutputPath, 
            noPlaylist: true 
        };
        
        if (isVideo) {
            const videoQuality = format === '2160p' ? 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 format === '1080p' ? 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 format === '720p'  ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 'best[height<=480][ext=mp4]/best[ext=mp4]/best';
            dlOptions.format = videoQuality;
            dlOptions.mergeOutputFormat = 'mp4';
        } else {
            dlOptions.format = 'ba/b';
            dlOptions.extractAudio = true;
            dlOptions.audioFormat = format;
            dlOptions.audioQuality = '0'; // 0 is best quality in yt-dlp
        }

        // 4. Start Download Process
        const dlProcess = exec(url, dlOptions);

        dlProcess.stdout.on('data', (data) => {
            const output = data.toString();
            const progressMatch = output.match(/\[download\]\s+([\d\.]+)\%/);
            if (progressMatch && clientId) {
                io.to(clientId).emit('progress', { percent: parseFloat(progressMatch[1]) });
            }
        });

        // PRO FIX: Await process completion properly and check exit code
        await new Promise((resolve, reject) => {
            dlProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`yt-dlp exited with error code ${code}`));
            });
            dlProcess.on('error', reject);
        });

        // 5. Verify File and Send Response
        if (!fs.existsSync(finalFilePath)) {
            throw new Error("Download process completed but file was not found.");
        }

        // Write ID3 tags for audio
        if (!isVideo && format === 'mp3') {
            NodeID3.write({
                title: cleanTitle, 
                artist: info.uploader || "PureWave", 
                album: "PureWave Downloads",
                image: imageBuffer ? { mime: "image/jpeg", type: { id: 3 }, imageBuffer: imageBuffer } : undefined
            }, finalFilePath);
        }

        // Send file securely and delete afterward
        res.download(finalFilePath, `${cleanTitle}.${fileExtension}`, (err) => {
            if (err) console.error("Error sending file to client:", err);
            // Always clean up the temp file
            if (fs.existsSync(finalFilePath)) fs.unlinkSync(finalFilePath); 
        });

    } catch (error) {
        console.error("\n--- EXTRACTION FAILED ---");
        console.error("URL:", url);
        console.error("Error Details:", error.message || error);
        console.error("-------------------------\n");
        
        if (!res.headersSent) {
            res.status(500).json({ error: 'Extraction failed.', details: error.message });
        }
    }
});

const PORT = process.env.PORT || 5000;
// PRO FIX: Use server.listen instead of app.listen to enable WebSocket progress!
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
