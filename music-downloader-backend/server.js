const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST']
}));

// ==========================================
// 🔴 YOUR EXACT RAPIDAPI CONFIGURATION 🔴
// ==========================================
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '0ac6974856msh59294fa085acc50p170fc6jsne422806d7be2';
const RAPIDAPI_HOST = 'youtube-mp3-audio-video-downloader.p.rapidapi.com'; 
// ==========================================

// Helper: Extract the 11-character video ID from any YouTube link
const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// --- LIGHTWEIGHT INFO ROUTE ---
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

// --- RAPIDAPI DOWNLOADER ROUTE (PATH-BASED ROUTING FIX) ---
app.get('/download', async (req, res) => {
    const { url, mode = 'audio' } = req.query; 

    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube link.' });
        }

        // Determine if user wants mp3 or mp4 path slice
        const isVideo = mode === 'video';
        const endpointType = isVideo ? 'mp4' : 'mp3';

        console.log(`Routing Video ID: ${videoId} to ${RAPIDAPI_HOST} via /${endpointType} route...`);

        // Setting up the request using Path Parameters instead of Query Parameters
        const options = {
            method: 'GET',
            url: `https://${RAPIDAPI_HOST}/${endpointType}/${videoId}`, 
            params: { 
                response_mode: 'default'
            }, 
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            }
        };

        const apiResponse = await axios.request(options);

        // Debug log to check the JSON format your API returns
        console.log("API Response Data:", apiResponse.data);

        // Extracting download link dynamically
        const downloadLink = apiResponse.data.link || apiResponse.data.url || apiResponse.data.download_url;

        if (downloadLink) {
            console.log("Link fetched successfully! Redirecting browser download stream...");
            res.redirect(downloadLink);
        } else {
            throw new Error("API responded but no media link key was found in the payload.");
        }

    } catch (error) {
        console.error("\n--- API EXTRACTION FAILED ---");
        console.error("Error Details:", error.message || error);
        if (error.response) {
            console.error("API Error Body:", error.response.data);
        }
        console.error("-------------------------\n");
        
        res.status(500).json({ error: 'API Extraction failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave API Gateway running securely on port ${PORT}`);
});
