const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));

// ==========================================
// 🔴 YOUR EXACT RAPIDAPI CONFIGURATION 🔴
// ==========================================
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '0ac6974856msh59294fa085acc50p170fc6jsne422806d7be2';
const RAPIDAPI_HOST = 'youtube-to-mp315.p.rapidapi.com'; 
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

// --- 2-STEP DOWNLOAD ROUTE ---
app.get('/download', async (req, res) => {
    const { url, mode = 'audio' } = req.query; 

    try {
        if (!url) return res.status(400).json({ error: 'Missing YouTube link.' });

        const isVideo = mode === 'video';
        const formatType = isVideo ? 'mp4' : 'mp3';

        console.log(`Step 1: Sending start request to ${RAPIDAPI_HOST}...`);

        // STEP 1: Start the task
        const startResponse = await axios.post(`https://${RAPIDAPI_HOST}/download`, {
            url: url,
            format: formatType,
            quality: 0
        }, {
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST,
                'Content-Type': 'application/json'
            }
        });

        const taskId = startResponse.data.id;
        if (!taskId) throw new Error("API did not return a Task ID.");

        console.log(`Task created! ID: ${taskId}. Step 2: Polling...`);

        // STEP 2: Poll the /status/{id} endpoint you found
        let downloadLink = null;
        let attempts = 0;
        
        while (attempts < 15) {
            await new Promise(resolve => setTimeout(resolve, 3000)); 
            attempts++;

            console.log(`Checking status... (${attempts}/15)`);
            
            const statusResponse = await axios.get(`https://${RAPIDAPI_HOST}/status/${taskId}`, {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': RAPIDAPI_HOST
                }
            });

            const currentStatus = statusResponse.data.status;

            if (currentStatus === 'AVAILABLE') {
                downloadLink = statusResponse.data.downloadUrl || statusResponse.data.link;
                break;
            } else if (currentStatus === 'CONVERSION_ERROR') {
                throw new Error("The API failed to convert the video.");
            }
        }

        if (downloadLink) {
            console.log("Success! Redirecting...");
            return res.redirect(downloadLink);
        } else {
            throw new Error("Conversion timed out.");
        }

    } catch (error) {
        console.error("\n--- API FAILED ---");
        console.error("Error:", error.message);
        if (error.response) console.error("Data:", error.response.data);
        console.error("------------------\n");
        
        res.status(500).json({ error: 'API failed.', details: error.message });
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`PureWave Gateway running on port ${PORT}`);
});
