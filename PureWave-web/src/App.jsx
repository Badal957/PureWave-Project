import { useState, useRef, useEffect } from 'react';
import { Download, Play, Pause, History, Info, X, Trash2, Settings2, Link, Video, Music } from 'lucide-react';
import { io } from 'socket.io-client';
import WaveSurfer from 'wavesurfer.js'; 
import './App.css';

const BASE_URL = 'http://localhost:5000';
const socket = io(BASE_URL);

// Helper function to format time
const formatTime = (seconds) => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// Dynamic Color Calculator to match the 4-color gradient!
const getBadgeColor = (currentTime, duration) => {
  if (!duration) return '#ff0044'; // Default to start color (Neon Red)
  const p = currentTime / duration;
  
  if (p <= 0.33) {
    // Red (#ff0044) to Purple (#b91d84)
    const factor = p / 0.33;
    const r = Math.round(255 + factor * (185 - 255));
    const g = Math.round(0 + factor * (29 - 0));
    const b = Math.round(68 + factor * (132 - 68));
    return `rgb(${r},${g},${b})`;
  } else if (p <= 0.66) {
    // Purple (#b91d84) to Cyan (#00d2ff)
    const factor = (p - 0.33) / 0.33;
    const r = Math.round(185 + factor * (0 - 185));
    const g = Math.round(29 + factor * (210 - 29));
    const b = Math.round(132 + factor * (255 - 132));
    return `rgb(${r},${g},${b})`;
  } else {
    // Cyan (#00d2ff) to Green (#1DB954)
    const factor = (p - 0.66) / 0.34;
    const r = Math.round(0 + factor * (29 - 0));
    const g = Math.round(210 + factor * (185 - 210));
    const b = Math.round(255 + factor * (84 - 255));
    return `rgb(${r},${g},${b})`;
  }
};

export default function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  
  const [mode, setMode] = useState('audio');
  const [format, setFormat] = useState('mp3');
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Extracting...');
  const [embedMetadata, setEmbedMetadata] = useState(true);

  // Waveform state tracking
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverX, setHoverX] = useState(-1);
  const [isWaveLoading, setIsWaveLoading] = useState(false);

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('okmusi_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const matrixCanvasRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferObj = useRef(null);

  // Matrix Rain Engine
  useEffect(() => {
    const canvas = matrixCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const chars = '0123456789';
    const fontSize = 14;
    const columns = Math.floor(window.innerWidth / fontSize);
    const drops = Array(columns).fill(1);

    const drawMatrix = () => {
      ctx.fillStyle = 'rgba(7, 7, 7, 0.05)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ff3333'; 
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const interval = setInterval(drawMatrix, 33);
    return () => { clearInterval(interval); window.removeEventListener('resize', resizeCanvas); };
  }, []);

  // Socket Progress Effect
  useEffect(() => {
    socket.on('progress', (data) => {
      setProgress(data.percent);
      setStatusText(`Extracting: ${data.percent}%`);
    });
    return () => socket.off('progress');
  }, []);

  // WAVESURFER INITIALIZATION
  useEffect(() => {
    if (currentMedia && currentMedia.type === 'audio' && waveformRef.current) {
      setIsWaveLoading(true);
      waveformRef.current.innerHTML = '';

      // Re-initialize the brilliant 4-color gradient for the wave
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const containerWidth = waveformRef.current.clientWidth || 800; 

      const multiColorGradient = ctx.createLinearGradient(0, 0, containerWidth, 0);
      multiColorGradient.addColorStop(0, '#ff0044');    
      multiColorGradient.addColorStop(0.33, '#b91d84'); 
      multiColorGradient.addColorStop(0.66, '#00d2ff'); 
      multiColorGradient.addColorStop(1, '#1DB954');    

      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#b3b3b3', // Flat, crisp light grey
        progressColor: multiColorGradient, // The 4-color gradient
        cursorColor: 'transparent', // Hiding default cursor
        barWidth: 2, 
        barGap: 1.5,
        barRadius: 2,
        height: 100, 
        normalize: true, 
      });

      ws.load(currentMedia.url);

      ws.on('play', () => setIsPlaying(true));
      ws.on('pause', () => setIsPlaying(false));
      ws.on('finish', () => setIsPlaying(false));
      
      ws.on('ready', () => {
        setIsWaveLoading(false); 
        setDuration(ws.getDuration()); 
      });
      
      ws.on('timeupdate', () => setCurrentTime(ws.getCurrentTime()));
      ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));

      wavesurferObj.current = ws;

      return () => {
        ws.destroy();
      };
    }
  }, [currentMedia]);

  const togglePlay = () => {
    if (currentMedia?.type === 'audio' && wavesurferObj.current) {
      wavesurferObj.current.playPause();
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleMode = () => {
    if (mode === 'audio') { setMode('video'); setFormat('1080p'); } 
    else { setMode('audio'); setFormat('mp3'); }
  };

  const handleDownload = async (urlToDownload = videoUrl) => {
    if (!urlToDownload) return showToast("Please paste a valid link.", "error");
    setIsDownloading(true);
    setProgress(0);
    setVideoUrl(urlToDownload); 

    try {
      const isPlaylist = urlToDownload.includes('list=') || urlToDownload.includes('/playlists/');
      let tracksToDownload = [urlToDownload];

      if (isPlaylist) {
        setStatusText("Parsing Playlist...");
        const plRes = await fetch(`${BASE_URL}/playlist?url=${encodeURIComponent(urlToDownload)}`);
        const plData = await plRes.json();
        if (plData.tracks && plData.tracks.length > 0) {
          tracksToDownload = plData.tracks;
          showToast(`Queuing ${tracksToDownload.length} tracks...`, "success");
        }
      }

      for (let i = 0; i < tracksToDownload.length; i++) {
        const trackUrl = tracksToDownload[i];
        if (tracksToDownload.length > 1) {
            setStatusText(`Item ${i + 1} of ${tracksToDownload.length}`);
            setProgress(0);
        } else {
            setStatusText("Initiating Protocol...");
        }

        const infoRes = await fetch(`${BASE_URL}/info?url=${encodeURIComponent(trackUrl)}`);
        const infoData = await infoRes.json();
        const cleanTitle = infoData.title ? infoData.title.replace(/[^a-zA-Z0-9 ]/g, "") : `Track_${i}`;
        const artistName = infoData.artist || infoData.uploader || 'Unknown Artist';

        const metaParam = embedMetadata && mode === 'audio' ? '&meta=true' : '';
        const downloadUrl = `${BASE_URL}/download?url=${encodeURIComponent(trackUrl)}&clientId=${socket.id}&format=${format}&mode=${mode}${metaParam}`;
        const downloadRes = await fetch(downloadUrl);
        
        if (!downloadRes.ok) throw new Error("Extraction failed");
        
        const blob = await downloadRes.blob();
        const blobUrl = URL.createObjectURL(blob);

        if (i === 0) {
            setCurrentMedia({ title: cleanTitle, artist: artistName, url: blobUrl, type: mode });
            setIsPlaying(false);
            setDuration(0);
            setCurrentTime(0);
            setHoverX(-1);
        }

        const newHistoryItem = {
            id: Date.now() + i, 
            title: cleanTitle, 
            artist: artistName, 
            videoId: infoData.videoId || Date.now().toString(),
            thumbnail: infoData.thumbnail || 'https://via.placeholder.com/320x180', 
            url: trackUrl
        };
        const updatedHistory = [newHistoryItem, ...history.filter(h => h.videoId !== infoData.videoId)].slice(0, 6);
        setHistory(updatedHistory);
        localStorage.setItem('okmusi_history', JSON.stringify(updatedHistory));

        setStatusText("Saving to disk...");
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${cleanTitle}.${mode === 'video' ? 'mp4' : format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        if (tracksToDownload.length > 1) await new Promise(r => setTimeout(r, 1000));
      }

      showToast("Extraction Complete", "success");
      setVideoUrl(''); 

    } catch (error) {
      console.error(error);
      showToast("Extraction failed.", "error");
    } finally {
      setIsDownloading(false);
      setProgress(0);
      setStatusText('Extracting...');
    }
  };

  const removeHistoryItem = (e, idToRemove) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== idToRemove);
    setHistory(updatedHistory);
    localStorage.setItem('okmusi_history', JSON.stringify(updatedHistory));
  };

  return (
    <div className="container">
      <canvas ref={matrixCanvasRef} className="bg-matrix"></canvas>
      <div className="bg-orb green-orb"></div>
      <div className="bg-orb blue-orb"></div>
      <div className="bg-grid"></div>

      <button className="info-btn" onClick={() => setShowAbout(true)}><Info size={24} color="#888" /></button>

      <div className="header">
        <div className="logo-container">
          <div className="icon-wrapper">
            <svg viewBox="0 0 100 100" className="live-logo-svg">
              <polyline points="15,50 35,50 45,20 60,80 75,50 85,50" className="pulse-line" />
            </svg>
          </div>
          <h1>
            PureWave <span className={`pro text-gradient-${mode}`}>
              {mode === 'audio' ? 'Resonance' : 'Vision'}
            </span>
          </h1>
        </div>
        <p>Studio Quality Web Extractor</p>
      </div>

      <div className="card">
        <div className="config-row">
            <label>{mode === 'audio' ? 'AUDIO LINK OR PLAYLIST' : 'VIDEO LINK OR PLAYLIST'}</label>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button className="video-glow-btn" onClick={toggleMode} title={mode === 'audio' ? "Switch to Video Mode" : "Switch to Audio Mode"}>
                    {mode === 'audio' ? <Video size={16} color="#fff" /> : <Music size={16} color="#fff" />}
                </button>
                
                <div className="format-selector">
                    <Settings2 size={14} color={mode === 'video' ? "#00d2ff" : "#1DB954"} />
                    <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={isDownloading}>
                        {mode === 'audio' ? (
                          <><option value="mp3">MP3 (320kbps)</option><option value="flac">FLAC (Lossless)</option><option value="wav">WAV (Raw)</option></>
                        ) : (
                          <><option value="2160p">MP4 (4K 2160p)</option><option value="1080p">MP4 (1080p)</option><option value="720p">MP4 (720p)</option><option value="480p">MP4 (480p)</option></>
                        )}
                    </select>
                </div>
            </div>
        </div>

        <div className="input-group" style={{ position: 'relative' }}>
          <Link size={20} color="#555" style={{ position: 'absolute', left: '16px', top: '18px' }} />
          <input 
            type="text" placeholder="Paste your URL here..." 
            value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} disabled={isDownloading}
            style={{ paddingLeft: '48px' }} 
          />
        </div>

        {mode === 'audio' && (
          <div className="meta-toggle-container">
            <label className="meta-checkbox-wrapper">
              <input type="checkbox" checked={embedMetadata} onChange={(e) => setEmbedMetadata(e.target.checked)} disabled={isDownloading} />
              <span className="checkmark"></span>
              Auto-Embed ID3 Tags & Album Art
            </label>
          </div>
        )}

        <button 
          className={`extract-btn ${isDownloading ? 'disabled' : ''}`}
          onClick={() => handleDownload(videoUrl)} disabled={isDownloading}
          style={mode === 'video' ? { background: 'linear-gradient(135deg, #00d2ff, #0052D4)' } : {}}
        >
          {isDownloading ? (
            <div className="progress-container">
                <span className="progress-text">{statusText}</span>
                <div className="progress-fill" style={{ width: `${progress}%`, background: mode === 'video' ? 'linear-gradient(90deg, #00d2ff, #3a7bd5)' : 'linear-gradient(90deg, #1DB954, #84cc16)' }}></div>
            </div>
          ) : (
            <><Download size={20} /> {mode === 'audio' ? 'Extract Audio' : 'Extract Video'}</>
          )}
        </button>
      </div>

      {currentMedia && (
        <div className="player" style={currentMedia.type === 'video' ? { flexDirection: 'column', padding: '16px', gap: '16px', alignItems: 'flex-start' } : { flexDirection: 'column', padding: '24px', alignItems: 'stretch' }}>
          {currentMedia.type === 'audio' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div className="player-text-wrapper">
                  <span className="player-title" style={{ fontSize: '15px' }}>{currentMedia.title}</span>
                  <span className="player-artist">{currentMedia.artist}</span>
                </div>
                <button className="play-btn" onClick={togglePlay}>
                  {isPlaying ? <Pause size={20} color="#000" /> : <Play size={20} color="#000" />}
                </button>
              </div>
              
              <div 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '75px', 
                  overflow: 'hidden', 
                  cursor: 'pointer',
                  background: '#000000'
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoverX(e.clientX - rect.left);
                }}
                onMouseLeave={() => setHoverX(-1)}
                onClick={(e) => {
                  if (wavesurferObj.current) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const progress = (e.clientX - rect.left) / rect.width;
                    wavesurferObj.current.seekTo(progress);
                  }
                }}
              >
                
                {/* Sharp Black Separating Line */}
                <div style={{ position: 'absolute', top: '50px', left: 0, right: 0, height: '2px', background: '#000', zIndex: 10, pointerEvents: 'none' }}></div>
                
                {/* Fade Overlay for the reflection */}
                <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, height: '23px', background: 'linear-gradient(to bottom, rgba(7,7,7,0.5) 0%, rgba(7,7,7,1) 100%)', zIndex: 10, pointerEvents: 'none' }}></div>

                {isWaveLoading && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#ff0044', fontSize: '12px', fontWeight: 'bold', zIndex: 20 }}>
                    Rendering Waveform...
                  </div>
                )}

                {/* Duration Badge */}
                {duration > 0 && !isWaveLoading && (
                  <div style={{ position: 'absolute', right: '0px', top: '25px', transform: 'translateY(-50%)', background: '#000', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px', zIndex: 15, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none' }}>
                    {formatTime(duration)}
                  </div>
                )}
                
                {/* Dynamic Background Color Badge! */}
                {currentTime > 0 && !isWaveLoading && (
                  <div style={{ position: 'absolute', left: '0px', top: '25px', transform: 'translateY(-50%)', background: getBadgeColor(currentTime, duration), color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '4px 6px', zIndex: 15, borderRadius: '4px', pointerEvents: 'none', transition: 'background 0.2s linear' }}>
                    {formatTime(currentTime)}
                  </div>
                )}

                {/* THE FIX: Pure transparent clear glass effect overlay */}
                {hoverX >= 0 && !isWaveLoading && (
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: hoverX, 
                    height: '50px', 
                    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
                    mixBlendMode: 'overlay', 
                    zIndex: 5, 
                    pointerEvents: 'none' 
                  }}></div>
                )}

                {/* The Waveform Canvas */}
                <div 
                  ref={waveformRef} 
                  style={{ 
                    width: '100%', 
                    height: '100px', 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    zIndex: 1,
                    pointerEvents: 'none' 
                  }}
                ></div>

              </div>
            </>
          ) : (
            <div style={{ width: '100%' }}>
              <span className="player-title" style={{ marginBottom: '12px', display: 'block' }}>{currentMedia.title}</span>
              <video src={currentMedia.url} controls autoPlay style={{ width: '100%', borderRadius: '12px', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
          )}
        </div>
      )}

      <div className="library-section">
        <div className="library-header">
          <div className="library-title-wrapper">
            <History size={16} color="#888" />
            <label style={{ marginBottom: 0 }}>RECENT EXTRACTS</label>
          </div>
          {history.length > 0 && (
            <button className="clear-history-btn" onClick={() => { setHistory([]); localStorage.removeItem('okmusi_history'); }}>
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>
        
        {history.length > 0 ? (
          <div className="library-grid">
            {history.map((item) => (
              <div key={item.id} className="library-item" onClick={() => !isDownloading && handleDownload(item.url)}>
                <button className="delete-item-btn" onClick={(e) => removeHistoryItem(e, item.id)} title="Remove"><X size={14} /></button>
                <img src={item.thumbnail} alt="thumbnail" />
                <div className="library-item-content">
                  <div className="library-item-title">{item.title}</div>
                  <div className="library-item-artist">{item.artist}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
             Your extraction history is clean. Drop a link above to begin.
          </div>
        )}
      </div>

      <div className={`toast ${toast ? 'show' : ''} ${toast?.type === 'error' ? 'error' : ''}`}>{toast?.message}</div>

      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowAbout(false)}><X size={24} color="#888" /></button>
            <h2>PureWave <span className={`pro text-gradient-${mode}`}>
              {mode === 'audio' ? 'Resonance' : 'Vision'}
            </span></h2>
            <div className="feature-list" style={{marginTop: '20px'}}>
              <div className="feature">
                  <h3 style={{color: '#fff', marginBottom: '4px'}}>Dual Engine Setup</h3>
                  <p style={{color: '#888', fontSize: '14px', margin: 0}}>Extract Lossless Audio or High-Definition Video.</p>
              </div>
              <div className="feature">
                  <h3 style={{color: '#fff', marginBottom: '4px', marginTop: '16px'}}>Playlist Automation</h3>
                  <p style={{color: '#888', fontSize: '14px', margin: 0}}>Paste a playlist link and watch it queue and download automatically.</p>
              </div>
              <div className="feature" style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{color: '#ff4444', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                    ⚠️ Usage Disclaimer
                  </h3>
                  <p style={{color: '#666', fontSize: '12px', margin: 0, lineHeight: '1.6'}}>
                    PureWave is a media extraction tool intended strictly for personal archiving and downloading content for which you possess the copyright or explicit permission. Users are solely responsible for complying with the Terms of Service of respective platforms and local copyright laws. Do not use this tool to distribute unauthorized copyrighted material.
                  </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}