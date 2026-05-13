const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ytdlp = require('yt-dlp-exec');
const { exec } = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const NodeID3 = require('node-id3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const cookiePath = path.join(__dirname, 'cookies.txt');

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());

io.on('connection', (socket) => {
    console.log(`Frontend Connected: ${socket.id}`);
});

app.get('/info', async (req, res) => {
    try {
        const info = await ytdlp(req.query.url, { 
            dumpSingleJson: true, noWarnings: true, cookies: cookiePath,
            addHeader: ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
        });
        res.json({ title: info.title, videoId: info.id, thumbnail: info.thumbnail, uploader: info.uploader });
    } catch (error) {
        res.status(500).json({ error: "Could not fetch info." });
    }
});

app.get('/playlist', async (req, res) => {
    try {
        const info = await ytdlp(req.query.url, { 
            dumpSingleJson: true, flatPlaylist: true, cookies: cookiePath,
            addHeader: ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
        });
        const tracks = info.entries.map(entry => entry.url || `https://www.youtube.com/watch?v=${entry.id}`);
        res.json({ title: info.title, tracks: tracks });
    } catch (error) {
        res.status(500).json({ error: "Could not fetch playlist." });
    }
});

// --- DUAL ENGINE DOWNLOADER (Audio & Video) ---
app.get('/download', async (req, res) => {
    // NEW: Accepts 'mode' (audio/video)
    const { url, clientId, format = 'mp3', mode = 'audio' } = req.query; 

    try {
        const info = await ytdlp(url, { 
            dumpSingleJson: true, noWarnings: true, cookies: cookiePath,
            addHeader: ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
        });

        const cleanTitle = info.title.replace(/[^a-zA-Z0-9 ]/g, '');
        const isVideo = mode === 'video';
        const fileExtension = isVideo ? 'mp4' : format;
        const tempFilePath = path.join(__dirname, `temp_${Date.now()}.${fileExtension}`);

        let imageBuffer = null;
        if (!isVideo && info.thumbnail) {
            try {
                const imgRes = await axios.get(info.thumbnail, { responseType: 'arraybuffer' });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (e) {}
        }

        // DYNAMIC CONFIGURATION: Changes based on Audio vs Video mode
        let dlOptions = {};
        
        if (isVideo) {
            // Video Mode Engine (NOW WITH 4K SUPPORT)
            const videoQuality = format === '2160p' ? 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 format === '1080p' ? 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 format === '720p' ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' :
                                 'best[height<=480][ext=mp4]/best[ext=mp4]/best'; // 480p fallback
            
            dlOptions = {
                format: videoQuality,
                mergeOutputFormat: 'mp4',
                output: tempFilePath,
                ffmpegLocation: ffmpegPath,
                noWarnings: true, noPlaylist: true, cookies: cookiePath,
                addHeader: ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
            };
        } else {
            // Audio Mode Engine
            dlOptions = {
                format: 'ba/b',
                extractAudio: true,
                audioFormat: format,
                ...(format === 'mp3' && { audioQuality: '320K' }),
                output: tempFilePath,
                ffmpegLocation: ffmpegPath,
                noWarnings: true, noPlaylist: true, cookies: cookiePath,
                addHeader: ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36']
            };
        }

        const dlProcess = exec(url, dlOptions);

        dlProcess.stdout.on('data', (data) => {
            const output = data.toString();
            const progressMatch = output.match(/\[download\]\s+([\d\.]+)\%/);
            if (progressMatch && clientId) {
                io.to(clientId).emit('progress', { percent: parseFloat(progressMatch[1]) });
            }
        });

        await new Promise((resolve, reject) => {
            dlProcess.on('close', resolve);
            dlProcess.on('error', reject);
        });

        setTimeout(() => {
            if (fs.existsSync(tempFilePath) && !isVideo && format === 'mp3') {
                NodeID3.write({
                    title: cleanTitle, artist: info.uploader || "PureWave", album: "PureWave Downloads",
                    image: imageBuffer ? { mime: "image/jpeg", type: { id: 3 }, imageBuffer: imageBuffer } : undefined
                }, tempFilePath);
            }

            res.download(tempFilePath, `${cleanTitle}.${fileExtension}`, () => {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); 
            });
        }, 1500); 

    } catch (error) {
        if (!res.headersSent) res.status(500).send('Extraction failed.');
    }
});

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`PureWave Dual-Engine Running on Port ${PORT}`);
});