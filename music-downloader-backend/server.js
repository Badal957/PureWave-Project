const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

// ==========================================
// 🔴 THE BULLETPROOF API CONFIGURATION 🔴
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

// --- BULLETPROOF 1-STEP DOWNLOAD ROUTE ---
app.get('/download', async (req, res) => {
    const { url } = req.query; 

    try {
        const videoId = extractVideoId(url);
        if (!videoId) return res.status(400).json({ error: 'Invalid YouTube link.' });

        console.log(`Sending Video ID: ${videoId} to stable API...`);

        // This exactly matches your provided snippet: GET /dl?id=...
        const options = {
            method: 'GET',
            url: `https://${RAPIDAPI_HOST}/dl`,
            params: { id: videoId }, 
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            }
        };

        const apiResponse = await axios.request(options);
        
        console.log("API Response Success!");

        // The youtube-mp36 API safely returns the final download URL in the 'link' property
        if (apiResponse.data && apiResponse.data.link) {
            console.log("Success! Redirecting directly to the media file...");
            return res.redirect(apiResponse.data.link);
        } else {
            throw new Error("Failed to extract link from standard response.");
        }

    } catch (error) {
        console.error("\n--- API EXTRACTION FAILED ---");
        console.error("Error Details:", error.message);
        if (error.response) console.error("Response Data:", error.response.data);
        console.error("-------------------------\n");
        
        res.status(500).json({ error: 'API Extraction failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave Stable Gateway running on port ${PORT}`);
});
