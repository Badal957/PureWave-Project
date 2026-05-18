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
// This checks your Railway Environment variables first, then falls back to your string
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '0ac6974856msh59294fa085acc50p170fc6jsne422806d7be2';
const RAPIDAPI_HOST = 'youtube-to-mp315.p.rapidapi.com'; // 👈 UPDATED TO YOUR NEW HOST
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

// --- 2-STEP RAPIDAPI DOWNLOADER ROUTE ---
app.get('/download', async (req, res) => {
    const { url, mode = 'audio' } = req.query; 

    try {
        if (!url) {
            return res.status(400).json({ error: 'Missing YouTube link.' });
        }

        const isVideo = mode === 'video';
        const formatType = isVideo ? 'mp4' : 'mp3';

        console.log(`Step 1: Sending conversion request to RapidAPI...`);

        // STEP 1: Ask the API to start converting (POST Request)
        const startResponse = await axios.post(`https://${RAPIDAPI_HOST}/download`, {
            url: url,          // This API requires the full URL, not just the ID!
            format: formatType,
            quality: 0
        }, {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST,
                'Content-Type': 'application/json'
            }
        });

        // The API gives us a unique UUID for this specific task
        const taskId = startResponse.data.id;
        if (!taskId) {
            throw new Error("Failed to initialize conversion task. API did not return a Task ID.");
        }

        console.log(`Task created successfully! Task ID: ${taskId}`);
        console.log(`Step 2: Polling for completion...`);

        // STEP 2: Check the status every 3 seconds until it is 'AVAILABLE'
        let downloadLink = null;
        let attempts = 0;
        const maxAttempts = 15; // Will wait a maximum of 45 seconds before timing out

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Pause for 3 seconds
            attempts++;

            console.log(`Checking status (Attempt ${attempts}/${maxAttempts})...`);
            
            const statusResponse = await axios.get(`https://${RAPIDAPI_HOST}/status/${taskId}`, {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': RAPIDAPI_HOST
                }
            });

            const currentStatus = statusResponse.data.status;

            if (currentStatus === 'AVAILABLE') {
                // We found the finish line! Extract the link.
                downloadLink = statusResponse.data.downloadUrl || statusResponse.data.link;
                break;
            } else if (currentStatus === 'CONVERSION_ERROR') {
                throw new Error("The API failed to convert this specific video.");
            }
            // If the status is 'CONVERTING', the loop just naturally continues to the next attempt
        }

        if (downloadLink) {
            console.log("File is ready! Redirecting browser...");
            return res.redirect(downloadLink);
        } else {
            throw new Error("Conversion timed out after 45 seconds.");
        }

    } catch (error) {
        console.error("\n--- API EXTRACTION FAILED ---");
        console.error("Error Details:", error.message || error);
        if (error.response) console.error("API Response:", error.response.data);
        console.error("-------------------------\n");
        
        res.status(500).json({ error: 'API Extraction failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave API Gateway running securely on port ${PORT}`);
});
