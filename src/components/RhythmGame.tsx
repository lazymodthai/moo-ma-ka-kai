// src/components/RhythmGame.tsx

import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Box, Grid, Paper, Typography, Button, Stack, keyframes, CircularProgress, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import ReplayIcon from '@mui/icons-material/Replay';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

import { useInterval } from '../hooks/useInterval';
import { allImages, type ImageDataObject } from '../data/imageData';
import BackgroundMusic from '../assets/background-music.mp3';

// --- Constants & Config ---
const TEMPO_BPM = 182;
const TOTAL_IMAGES = 8;
const TOTAL_ROUNDS = 10;
const PRE_GAME_COUNTDOWN = 16;
const INTERMISSION_COUNTDOWN = 8;
const MS_PER_BEAT = (60 / TEMPO_BPM) * 1000;
const speechRecognitionOptions = { continuous: true, interimResults: true, language: 'th-TH' };

// --- UI Enhancements: Animations ---
const popIn = keyframes` 0% { transform: scale(0.9); } 100% { transform: scale(1.05); }`;
const shake = keyframes` 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); }`;

const StyledCard = styled(Paper, { shouldForwardProp: (prop) => prop !== 'feedback' })<{ feedback: Feedback }>(({ feedback }) => ({
  aspectRatio: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease-in-out',
  animation: feedback === 'correct' ? `${popIn} 0.2s ease-out` : feedback === 'incorrect' ? `${shake} 0.3s ease-in-out` : 'none',
  overflow: 'hidden',
}));

// --- Helper Functions ---
const getRandomImagesWithDuplicates = (array: ImageDataObject[], count: number): ImageDataObject[] => {
  const result: ImageDataObject[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * array.length);
    result.push(array[randomIndex]);
  }
  return result;
};

// --- Type Definitions ---
type GameState = 'permission_prompt' | 'permission_denied' | 'loading' | 'ready' | 'countdown' | 'running' | 'intermission' | 'finished';
type Feedback = 'pending' | 'correct' | 'incorrect';
type ResourceStatus = {
  audio: boolean;
  speech: boolean;
  images: boolean;
};

// --- Component ---
const RhythmGame: React.FC = () => {
  // States
  const [gameState, setGameState] = useState<GameState>('permission_prompt');
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(PRE_GAME_COUNTDOWN);
  const [isBeatOn, setIsBeatOn] = useState(false);
  const [gameImages, setGameImages] = useState<ImageDataObject[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [feedback, setFeedback] = useState<Feedback[]>(Array(TOTAL_IMAGES).fill('pending'));
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus>({ audio: false, speech: false, images: false });
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  // Web Audio API Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Resource preloading functions
  const preloadAudio = async (): Promise<boolean> => {
    try {
      console.log("Preloading audio...");
      
      // Check if BackgroundMusic is available
      if (!BackgroundMusic) {
        console.warn("BackgroundMusic asset not found, skipping audio preload");
        return true; // Consider it successful to not block the game
      }

      console.log("Creating AudioContext...");
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("AudioContext created:", audioContextRef.current.state);
      }
      const audioContext = audioContextRef.current;

      if (audioContext.state === 'suspended') {
        console.log("AudioContext suspended, resuming...");
        await audioContext.resume();
        console.log("AudioContext resumed:", audioContext.state);
      }

      console.log("Fetching audio file from:", BackgroundMusic);
      const response = await fetch(BackgroundMusic, {
        method: 'GET',
        headers: {
          'Accept': 'audio/*'
        }
      });
      
      console.log("Audio fetch response:", response.status, response.statusText);
      if (!response.ok) {
        throw new Error(`Audio fetch failed: ${response.status} ${response.statusText}`);
      }
      
      console.log("Converting to ArrayBuffer...");
      const arrayBuffer = await response.arrayBuffer();
      console.log("ArrayBuffer size:", arrayBuffer.byteLength, "bytes");
      
      console.log("Decoding audio data...");
      audioBufferRef.current = await audioContext.decodeAudioData(arrayBuffer);
      console.log("Audio decoded successfully, duration:", audioBufferRef.current.duration, "seconds");
      
      return true;
    } catch (error:any) {
      console.error("Error preloading audio:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Don't block the game for audio issues
      console.log("Audio preload failed, but continuing without background music");
      setErrorMessage("ไม่สามารถโหลดเพลงพื้นหลังได้ แต่สามารถเล่นเกมได้");
      return true; // Return true to not block the game
    }
  };

  const preloadSpeechRecognition = async (): Promise<boolean> => {
    try {
      console.log("Testing speech recognition...");
      
      if (!browserSupportsSpeechRecognition) {
        console.error("Browser doesn't support speech recognition");
        return false;
      }

      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          console.log("Speech recognition test completed (timeout - assuming success)");
          SpeechRecognition.stopListening();
          resolve(true); // Assume success on timeout
        }, 2000);

        try {
          SpeechRecognition.startListening({
            ...speechRecognitionOptions,
            continuous: false, // Use non-continuous for testing
          });

          // Auto-resolve as success after a short delay
          setTimeout(() => {
            clearTimeout(timeoutId);
            SpeechRecognition.stopListening();
            console.log("Speech recognition test completed successfully");
            resolve(true);
          }, 1000);

        } catch (startError) {
          console.error("Failed to start speech recognition:", startError);
          clearTimeout(timeoutId);
          resolve(false);
        }
      });
    } catch (error) {
      console.error("Error testing speech recognition:", error);
      setErrorMessage("ไม่สามารถเริ่มระบบรู้จำเสียงได้");
      return false;
    }
  };

  const preloadImages = async (): Promise<boolean> => {
    try {
      console.log("Preloading images...");
      console.log("Total images to load:", allImages.length);
      
      let loadedCount = 0;
      const imagePromises = allImages.map((item, index) => 
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            loadedCount++;
            console.log(`Image ${loadedCount}/${allImages.length} loaded: ${item.text}`);
            resolve();
          };
          img.onerror = (error) => {
            console.error(`Failed to load image ${index + 1}:`, item.image, error);
            // Don't reject, just resolve to continue with other images
            loadedCount++;
            resolve();
          };
          img.src = item.image;
        })
      );

      await Promise.all(imagePromises);
      console.log(`Images preloading completed: ${loadedCount}/${allImages.length} loaded`);
      
      // Consider successful even if some images failed
      return true;
    } catch (error) {
      console.error("Error preloading images:", error);
      setErrorMessage("ไม่สามารถโหลดรูปภาพได้ครบถ้วน");
      return true; // Still allow game to continue
    }
  };

  // Initialize resources after permission is granted
  const initializeResources = async () => {
    console.log("Starting resource initialization...");
    setGameState('loading');
    setLoadingProgress(0);
    setErrorMessage('');
    
    const newResourceStatus = { audio: false, speech: false, images: false };

    try {
      // Preload audio
      console.log("Step 1/3: Preloading audio...");
      newResourceStatus.audio = await preloadAudio();
      setResourceStatus({ ...newResourceStatus });
      setLoadingProgress(33);

      // Test speech recognition
      console.log("Step 2/3: Testing speech recognition...");
      newResourceStatus.speech = await preloadSpeechRecognition();
      setResourceStatus({ ...newResourceStatus });
      setLoadingProgress(66);

      // Preload images
      console.log("Step 3/3: Preloading images...");
      newResourceStatus.images = await preloadImages();
      setResourceStatus({ ...newResourceStatus });
      setLoadingProgress(100);

      // Check if all resources are ready
      const allResourcesReady = Object.values(newResourceStatus).every(status => status);
      
      console.log("Resource loading complete:", newResourceStatus);
      console.log("All resources ready:", allResourcesReady);
      
      if (allResourcesReady) {
        console.log("All resources loaded successfully! Game is ready.");
        setGameState('ready');
      } else {
        console.log("Some resources failed to load, but allowing user to continue");
        setGameState('ready'); // Allow user to try anyway, but show warnings
      }
    } catch (error:any) {
      console.error("Error during resource initialization:", error);
      setErrorMessage(`เกิดข้อผิดพลาดในการเตรียมความพร้อม: ${error.message}`);
      setGameState('ready'); // Still allow user to try
    }
  };

  // Initial Permission & Asset Check Hook
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        console.log("Checking initial permission...");
        
        if (!navigator.permissions) {
          console.warn("Permissions API not supported, trying direct media access test.");
          // Try to access media directly to test permission
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop()); // Stop immediately after test
            console.log("Media access test successful, initializing resources");
            initializeResources();
          } catch (mediaError) {
            console.log("Media access test failed, showing permission prompt");
            setGameState('permission_prompt');
          }
          return;
        }
        
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        console.log("Permission status:", permissionStatus.state);
        
        if (permissionStatus.state === 'granted') {
          console.log("Permission already granted, initializing resources");
          initializeResources();
        } else if (permissionStatus.state === 'denied') {
          console.log("Permission denied");
          setGameState('permission_denied');
        } else {
          console.log("Permission prompt needed");
          setGameState('permission_prompt');
        }
        
        permissionStatus.onchange = () => {
          console.log("Permission status changed to:", permissionStatus.state);
          if (permissionStatus.state === 'granted') {
            initializeResources();
          }
        };
      } catch (error) {
        console.error("Error checking initial microphone permission:", error);
        console.log("Fallback: showing permission prompt");
        setGameState('permission_prompt');
      }
    };

    checkInitialPermission();
    setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES));
  }, []);

  // Speech Recognition Keep-Alive Hook
  useEffect(() => { 
    const isGameActive = ['countdown', 'running', 'intermission'].includes(gameState);
    if (isGameActive && !listening && resourceStatus.speech) { 
      console.log("Speech recognition keep-alive triggered. Restarting...");
      SpeechRecognition.startListening(speechRecognitionOptions); 
    } 
  }, [listening, gameState, resourceStatus.speech]);

  // Real-time Speech Checking Hook
  useEffect(() => { 
    if (gameState !== 'running' || activeIndex < 0 || feedback[activeIndex] === 'correct') return; 
    const correctWord = gameImages[activeIndex]?.text; 
    if (transcript.trim().toLowerCase().includes(correctWord.toLowerCase())) { 
      setScore(prev => prev + 1); 
      setFeedback(prev => { 
        const newFeedback = [...prev]; 
        newFeedback[activeIndex] = 'correct'; 
        return newFeedback; 
      }); 
      resetTranscript(); 
    } 
  }, [transcript, activeIndex, gameState, gameImages, feedback, resetTranscript]);

  // Main Game Loop Hook
  useInterval(() => { 
    setIsBeatOn(prev => !prev); 
    switch (gameState) { 
      case 'countdown': 
        if (countdown > 1) setCountdown(prev => prev - 1); 
        else { setGameState('running'); setActiveIndex(0); } 
        break; 
      case 'intermission': 
        if (countdown > 1) setCountdown(prev => prev - 1); 
        else { setCurrentRound(prev => prev + 1); setGameState('running'); setActiveIndex(0); } 
        break; 
      case 'running': 
        if (activeIndex >= 0 && feedback[activeIndex] === 'pending') { 
          setFeedback(prev => { const newFeedback = [...prev]; newFeedback[activeIndex] = 'incorrect'; return newFeedback; }); 
        } 
        const nextIndex = (activeIndex + 1) % TOTAL_IMAGES; 
        if (nextIndex === 0) { 
          if (currentRound >= TOTAL_ROUNDS) { 
            setGameState('finished'); 
            stopGame(); 
          } else { 
            setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES)); 
            setFeedback(Array(TOTAL_IMAGES).fill('pending')); 
            setGameState('intermission'); 
            setCountdown(INTERMISSION_COUNTDOWN); 
            setActiveIndex(-1); 
          } 
        } else { 
          setActiveIndex(nextIndex); 
        } 
        break; 
    } 
  }, !['ready', 'finished', 'permission_prompt', 'permission_denied', 'loading'].includes(gameState) ? MS_PER_BEAT : null);

  // Web Audio API Control Functions
  const playMusic = async () => {
    try {
      if (!audioContextRef.current || !audioBufferRef.current) {
        console.warn("Audio not ready, skipping music playback");
        return;
      }

      const audioContext = audioContextRef.current;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContext.destination);
      source.loop = false;
      source.start(0);

      audioSourceRef.current = source;
    } catch (error) {
      console.error("Error playing music:", error);
    }
  };

  const stopMusic = () => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
  };

  // Game Control Functions
  const handleRequestPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone permission granted!");
      initializeResources();
    } catch (error) {
      console.error("Microphone permission was denied:", error);
      setGameState('permission_denied');
    }
  };

  const startGame = () => {
    // Double-check resources before starting
    const allResourcesReady = Object.values(resourceStatus).every(status => status);
    if (!allResourcesReady) {
      console.warn("Starting game with some resources not ready");
    }

    setScore(0);
    setCurrentRound(1);
    setFeedback(Array(TOTAL_IMAGES).fill('pending'));
    setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES));
    setActiveIndex(-1);
    resetTranscript();
    setCountdown(PRE_GAME_COUNTDOWN);
    setGameState('countdown');
    
    if (resourceStatus.speech) {
      SpeechRecognition.startListening(speechRecognitionOptions);
    }
    if (resourceStatus.audio) {
      playMusic();
    }
  };

  const stopGame = () => { 
    setGameState('ready'); 
    SpeechRecognition.stopListening(); 
    stopMusic();
    setActiveIndex(-1); 
  };
  
  // --- Render Logic ---
  if (!browserSupportsSpeechRecognition) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', maxWidth: '600px' }}>
        <WarningIcon color="error" sx={{ fontSize: 60 }} />
        <Typography variant="h6" color="error" sx={{ mt: 2 }}>
          เบราว์เซอร์นี้ไม่รองรับการรู้จำเสียง
        </Typography>
        <Typography sx={{ mt: 1 }}>
          โปรดใช้ Chrome, Edge หรือ Safari เวอร์ชันใหม่
        </Typography>
      </Paper>
    );
  }

  const getBorderColor = (index: number): string => { 
    if (feedback[index] === 'correct') return '#4caf50'; 
    if (feedback[index] === 'incorrect') return '#f44336'; 
    if (index === activeIndex) return '#1976d2'; 
    return 'transparent'; 
  };
  
  const isFlashing = (gameState === 'countdown' || gameState === 'intermission') && isBeatOn;

  // Permission screens
  if (gameState === 'permission_prompt' || gameState === 'permission_denied') {
    return (
      <Paper sx={{ width: '100%', maxWidth: '600px', p: 4, borderRadius: 5, textAlign: 'center' }}>
        {gameState === 'permission_prompt' ? (
          <>
            <MicIcon color="primary" sx={{ fontSize: 60 }} />
            <Typography variant="h5" sx={{ mt: 2, fontFamily: 'Roboto, sans-serif' }}>
              เกมนี้ต้องใช้ไมโครโฟน
            </Typography>
            <Typography sx={{ mt: 1, mb: 3 }}>
              เพื่อเริ่มเล่นเกม โปรดอนุญาตให้เบราว์เซอร์เข้าถึงไมโครโฟนของคุณ
            </Typography>
            <Button variant="contained" size="large" onClick={handleRequestPermission}>
              พร้อมแล้ว! ขออนุญาตใช้ไมค์
            </Button>
          </>
        ) : (
          <>
            <MicOffIcon color="error" sx={{ fontSize: 60 }} />
            <Typography variant="h5" sx={{ mt: 2, fontFamily: 'Roboto, sans-serif' }}>
              การเข้าถึงไมโครโฟนถูกปฏิเสธ
            </Typography>
            <Typography sx={{ mt: 1, mb: 3 }}>
              โปรดกดที่รูปแม่กุญแจ 🔒 บนแถบ URL แล้วอนุญาตให้เว็บไซต์นี้ใช้ไมโครโฟน จากนั้นรีเฟรชหน้าเว็บ
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              รีเฟรชหน้า
            </Button>
          </>
        )}
      </Paper>
    );
  }

  // Loading screen
  if (gameState === 'loading') {
    return (
      <Paper sx={{ width: '100%', maxWidth: '600px', p: 4, borderRadius: 5, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h5" sx={{ mt: 3, mb: 2 }}>
          กำลังเตรียมความพร้อม...
        </Typography>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ mb: 1 }}>
            ความคืบหน้า: {loadingProgress}%
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {resourceStatus.audio ? <CheckCircleIcon color="success" /> : <CircularProgress size={16} />}
              <Typography variant="body2">โหลดเพลงพื้นหลัง</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {resourceStatus.speech ? <CheckCircleIcon color="success" /> : <CircularProgress size={16} />}
              <Typography variant="body2">ทดสอบระบบรู้จำเสียง</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {resourceStatus.images ? <CheckCircleIcon color="success" /> : <CircularProgress size={16} />}
              <Typography variant="body2">โหลดรูปภาพ</Typography>
            </Box>
          </Box>
        </Box>
        {errorMessage && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}
      </Paper>
    );
  }

  // Main game screen
  return (
    <Paper 
      sx={{ 
        width: '100%', maxWidth: '900px', p: { xs: 2, sm: 4 }, borderRadius: 5, 
        transition: 'box-shadow 0.1s ease-in-out', 
        boxShadow: isFlashing ? '0 0 30px 10px #ffc107' : '0px 10px 30px rgba(0,0,0,0.1)', 
        background: 'linear-gradient(145deg, #ffffff, #f9f9f9)' 
      }} 
      elevation={0}
    >
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <Box sx={{ position: 'fixed', top: 10, right: 10, background: 'rgba(0,0,0,0.8)', color: 'white', p: 1, borderRadius: 1, fontSize: '12px' }}>
          <div>State: {gameState}</div>
          <div>Audio: {resourceStatus.audio ? '✓' : '✗'}</div>
          <div>Speech: {resourceStatus.speech ? '✓' : '✗'}</div>
          <div>Images: {resourceStatus.images ? '✓' : '✗'}</div>
          <div>Progress: {loadingProgress}%</div>
        </Box>
      )}

      <Typography variant="h4" gutterBottom textAlign="center" sx={{ mb: 3 }}>
        หมู หมา กา ไก่
      </Typography>
      
      {/* Resource status indicators */}
      {gameState === 'ready' && !Object.values(resourceStatus).every(status => status) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            ทรัพยากรบางส่วนไม่พร้อม: 
            {!resourceStatus.audio && ' เสียงเพลง'}
            {!resourceStatus.speech && ' ระบบรู้จำเสียง'}
            {!resourceStatus.images && ' รูปภาพ'}
          </Typography>
        </Alert>
      )}

      {gameState === 'finished' ? (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography variant="h5" sx={{ fontFamily: 'Roboto, sans-serif' }}>จบเกม!</Typography>
          <Typography variant="h4" color="primary" sx={{ my: 2 }}>คะแนนสุดท้าย: {score}</Typography>
          <Button variant="contained" startIcon={<ReplayIcon/>} onClick={startGame} sx={{mt: 2}}>เล่นอีกครั้ง</Button>
        </Box>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-around" alignItems="center" sx={{ mb: 3, p: 2, background: 'rgba(255, 224, 130, 0.2)', borderRadius: 4 }}>
            <Typography variant="h6">รอบที่: {currentRound > 0 ? currentRound : '-'} / {TOTAL_ROUNDS}</Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ScoreboardIcon color="primary" />
              <Typography variant="h6">คะแนน: {score}</Typography>
            </Stack>
          </Stack>
          <Grid container spacing={2}>
            {gameImages.map((item, index) => (
              <Grid size={3} key={`${item.key}-${index}-${currentRound}`}>
                <StyledCard
                  elevation={4}
                  feedback={feedback[index]}
                  sx={{ 
                    border: `5px solid ${getBorderColor(index)}`, 
                    transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)', 
                    opacity: (gameState === 'running') ? 1 : 0.75 
                  }}
                >
                  <img src={item.image} alt={item.text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </StyledCard>
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={startGame} 
              disabled={gameState !== 'ready'}
              size="large"
              startIcon={<PlayArrowIcon />}
            >
              เริ่มเกม
            </Button>
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={stopGame} 
              disabled={!['countdown', 'running', 'intermission'].includes(gameState)}
              size="large"
              startIcon={<StopIcon />}
            >
              หยุด
            </Button>
          </Stack>
          <Box sx={{ mt: 3, p: 2, background: '#f5f5f5', borderRadius: 3, textAlign: 'center', minHeight: '60px' }}>
            <Typography variant="h6" color="secondary">
              คำที่พูดล่าสุด: <span style={{color: '#ff8f00', fontWeight: 'bold'}}>{transcript}</span>
            </Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default RhythmGame;