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

// --- RAPIDAPI DOWNLOADER ROUTE (SMART PATH RECOVERY) ---
app.get('/download', async (req, res) => {
    const { url, mode = 'audio' } = req.query; 

    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube link.' });
        }

        const isVideo = mode === 'video';
        const formatType = isVideo ? 'mp4' : 'mp3';

        // Array of possible endpoint paths this specific developer might use
        const possibleUrls = [
            `https://${RAPIDAPI_HOST}/download/${formatType}/${videoId}`, // Try Path 1: /download/mp3/ID
            `https://${RAPIDAPI_HOST}/${formatType}/${videoId}`,          // Try Path 2: /mp3/ID
            `https://${RAPIDAPI_HOST}/download/${videoId}`                // Try Path 3: /download/ID
        ];

        let apiResponse = null;
        let lastError = null;

        // Loop through the paths until one works
        for (const apiUrl of possibleUrls) {
            try {
                console.log(`Testing endpoint path: ${apiUrl}`);
                const response = await axios.get(apiUrl, {
                    params: { response_mode: 'default' },
                    headers: {
                        'X-RapidAPI-Key': RAPIDAPI_KEY,
                        'X-RapidAPI-Host': RAPIDAPI_HOST
                    }
                });
                
                // If we get here without throwing an error, we found the right path!
                apiResponse = response;
                break; 
            } catch (err) {
                lastError = err;
                // If it's a 404, continue the loop to try the next path structure
                if (err.response && err.response.status === 404) {
                    console.log(`Path 404'd. Swapping to next configuration...`);
                    continue;
                }
                // If it's a different error (like 401 or 403), break early because it's an auth issue
                break;
            }
        }

        if (!apiResponse) {
            throw new Error(`All endpoint structural attempts failed. Last status: ${lastError.response ? lastError.response.status : lastError.message}`);
        }

        // Debug log the winning payload format
        console.log("Successful API Response Data:", apiResponse.data);

        // Extract and route the file link
        const downloadLink = apiResponse.data.link || apiResponse.data.url || apiResponse.data.download_url;

        if (downloadLink) {
            console.log("Link verified. Redirecting download stream directly to browser client!");
            return res.redirect(downloadLink);
        } else {
            throw new Error("API path matched, but response payload was missing a direct download URL string.");
        }

    } catch (error) {
        console.error("\n--- API EXTRACTION FAILED ---");
        console.error("Error Details:", error.message || error);
        console.error("-------------------------\n");
        
        res.status(500).json({ error: 'API Extraction failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave API Gateway running securely on port ${PORT}`);
});
