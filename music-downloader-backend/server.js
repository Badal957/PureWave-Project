const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const fs = require('fs');
const path = require('path');
const NodeID3 = require('node-id3'); 

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST'], exposedHeaders: ['Content-Disposition'] }));

// ==========================================
// 🔴 THE BULLETPROOF AUDIO API CONFIGURATION 🔴
// ==========================================
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '0ac6974856msh59294fa085acc50p170fc6jsne422806d7be2';
const RAPIDAPI_HOST = 'youtube-mp36.p.rapidapi.com'; 
// ==========================================

const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- INFO ROUTE ---
app.get('/info', (req, res) => {
    try {
        const videoId = extractVideoId(req.query.url);
        if (!videoId) throw new Error("Invalid URL");
        res.json({ 
            title: "PureWave Stream Ready",
            videoId: videoId, 
            thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, 
            uploader: "RapidAPI Engine" 
        });
    } catch (error) {
        res.status(500).json({ error: "Could not parse YouTube URL." });
    }
});

// --- BULLETPROOF AUDIO DOWNLOAD ROUTE ---
app.get('/download', async (req, res) => {
    const { url } = req.query; 

    try {
        const videoId = extractVideoId(url);
        if (!videoId) return res.status(400).json({ error: 'Invalid YouTube link.' });

        console.log(`Sending Video ID: ${videoId} to stable API for 160kbps MP3...`);

        // 1. Request the link from RapidAPI (Asking explicitly for 160kbps)
        const options = {
            method: 'GET',
            url: `https://${RAPIDAPI_HOST}/dl`,
            params: { 
                id: videoId,
                quality: '160' // 👈 Requesting 160kbps from the API
            }, 
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            }
        };

        const apiResponse = await axios.request(options);
        
        if (!apiResponse.data || !apiResponse.data.link) {
            throw new Error("Failed to extract link from API response.");
        }

        const downloadUrl = apiResponse.data.link;
        const rawTitle = apiResponse.data.title || "PureWave_Audio";
        const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9 ()\-]/g, "").trim() || "Audio_Download";
        
        const tempId = Date.now();
        const tempFilePath = path.join(__dirname, `temp_${tempId}.mp3`);

        console.log("Link generated! Intercepting MP3 to add tags and clean name...");

        // 2. Download the MP3 into your Railway Server temporarily
        const fileResponse = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(tempFilePath);
        fileResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 3. Add Thumbnail Image and ID3 Tags
        let imageBuffer = null;
        try {
            const thumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
            const imgRes = await axios.get(thumbUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(imgRes.data);
            console.log("Thumbnail injected!");
        } catch (e) {
            console.log("Failed to download thumbnail, continuing without it.");
        }

        NodeID3.write({
            title: cleanTitle, 
            artist: "PureWave Audio", 
            image: imageBuffer ? { mime: "image/jpeg", type: { id: 3 }, imageBuffer: imageBuffer } : undefined
        }, tempFilePath);

        // 4. Send the perfectly named, tagged MP3 to the user's browser
        res.download(tempFilePath, `${cleanTitle}.mp3`, (err) => {
            if (err) console.error("Error sending file to client:", err);
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); 
        });

    } catch (error) {
        console.error("\n--- API EXTRACTION FAILED ---");
        console.error("Error Details:", error.message);
        console.error("-------------------------\n");
        
        res.status(500).json({ error: 'API Extraction failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave Stable Audio Gateway running on port ${PORT}`);
});
