// src/components/RhythmGame.tsx

import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Box, Grid, Paper, Typography, Button, Stack, keyframes } from '@mui/material';
import { styled } from '@mui/material/styles';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import ReplayIcon from '@mui/icons-material/Replay';

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
  // *** CHANGED: Added overflow hidden to clip the image corners
  overflow: 'hidden',
}));


// *** CHANGED: New function to allow duplicates ***
const getRandomImagesWithDuplicates = (array: ImageDataObject[], count: number): ImageDataObject[] => {
  const result: ImageDataObject[] = [];
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * array.length);
    result.push(array[randomIndex]);
  }
  return result;
};


// --- Type Definitions ---
type GameState = 'idle' | 'countdown' | 'running' | 'intermission' | 'finished';
type Feedback = 'pending' | 'correct' | 'incorrect';

// --- Component ---
const RhythmGame: React.FC = () => {
  // States (no changes)
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(PRE_GAME_COUNTDOWN);
  const [isBeatOn, setIsBeatOn] = useState(false);
  const [gameImages, setGameImages] = useState<ImageDataObject[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [feedback, setFeedback] = useState<Feedback[]>(Array(TOTAL_IMAGES).fill('pending'));
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // --- Initial Setup ---
  useEffect(() => {
    audioRef.current = new Audio(BackgroundMusic);
    audioRef.current.loop = false;
    // *** CHANGED: Use the new image generation function
    setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES));
  }, []);

  // Hooks (no changes in logic)
  useEffect(() => { if (gameState !== 'idle' && gameState !== 'finished' && !listening) { SpeechRecognition.startListening(speechRecognitionOptions); } }, [listening, gameState]);
  useEffect(() => { if (gameState !== 'running' || activeIndex < 0 || feedback[activeIndex] === 'correct') return; const correctWord = gameImages[activeIndex]?.text; if (transcript.trim().toLowerCase().includes(correctWord.toLowerCase())) { setScore(prev => prev + 1); setFeedback(prev => { const newFeedback = [...prev]; newFeedback[activeIndex] = 'correct'; return newFeedback; }); resetTranscript(); } }, [transcript, activeIndex, gameState, gameImages, feedback, resetTranscript]);
  useInterval(() => { setIsBeatOn(prev => !prev); switch (gameState) { case 'countdown': if (countdown > 1) setCountdown(prev => prev - 1); else { setGameState('running'); setActiveIndex(0); } break; case 'intermission': if (countdown > 1) setCountdown(prev => prev - 1); else { setCurrentRound(prev => prev + 1); setGameState('running'); setActiveIndex(0); } break; case 'running': if (activeIndex >= 0 && feedback[activeIndex] === 'pending') { setFeedback(prev => { const newFeedback = [...prev]; newFeedback[activeIndex] = 'incorrect'; return newFeedback; }); } const nextIndex = (activeIndex + 1) % TOTAL_IMAGES; if (nextIndex === 0) { if (currentRound >= TOTAL_ROUNDS) { setGameState('finished'); stopGame(); } else { /* *** CHANGED: Use new image function *** */ setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES)); setFeedback(Array(TOTAL_IMAGES).fill('pending')); setGameState('intermission'); setCountdown(INTERMISSION_COUNTDOWN); setActiveIndex(-1); } } else { setActiveIndex(nextIndex); } break; } }, gameState !== 'idle' && gameState !== 'finished' ? MS_PER_BEAT : null);

  // Control Functions
  const startGame = () => {
    setScore(0);
    setCurrentRound(1);
    setFeedback(Array(TOTAL_IMAGES).fill('pending'));
    // *** CHANGED: Use new image function
    setGameImages(getRandomImagesWithDuplicates(allImages, TOTAL_IMAGES));
    setActiveIndex(-1);
    resetTranscript();
    setCountdown(PRE_GAME_COUNTDOWN);
    setGameState('countdown');
    SpeechRecognition.startListening(speechRecognitionOptions);
    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
  };
  const stopGame = () => { setGameState('idle'); SpeechRecognition.stopListening(); if (audioRef.current) { audioRef.current.pause(); } setActiveIndex(-1); };
  
  // Render Logic
  if (!browserSupportsSpeechRecognition) return <Typography color="error">Browser doesn't support speech recognition.</Typography>;
  const getBorderColor = (index: number): string => { if (feedback[index] === 'correct') return '#4caf50'; if (feedback[index] === 'incorrect') return '#f44336'; if (index === activeIndex) return '#1976d2'; return 'transparent'; };
  const isFlashing = (gameState === 'countdown' || gameState === 'intermission') && isBeatOn;

  return (
    <Paper 
      sx={{ 
        width: '100%', maxWidth: '900px', p: { xs: 2, sm: 4 }, borderRadius: 5,
        transition: 'box-shadow 0.1s ease-in-out',
        boxShadow: isFlashing ? '0 0 30px 10px #ffc107' : '0px 10px 30px rgba(0,0,0,0.1)',
        background: 'linear-gradient(145deg, #ffffff, #f9f9f9)',
      }} 
      elevation={0}
    >
      <Typography variant="h4" gutterBottom textAlign="center" sx={{ mb: 3 }}>หมู หมา กา ไก่</Typography>
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
              <Grid size={3} key={`${item.key}-${index}-${currentRound}`}> {/* *** CHANGED: Key now includes index for uniqueness */}
                <StyledCard
                  elevation={4}
                  feedback={feedback[index]}
                  sx={{
                    border: `5px solid ${getBorderColor(index)}`,
                    transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)',
                    opacity: (gameState === 'running') ? 1 : 0.75,
                  }}
                >
                  {/* *** CHANGED: Image style to fill the card *** */}
                  <img src={item.image} alt={item.text} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </StyledCard>
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button variant="contained" color="primary" onClick={startGame} disabled={gameState !== 'idle'}>เริ่มเกม</Button>
            <Button variant="contained" color="secondary" onClick={stopGame} disabled={!['countdown', 'running', 'intermission'].includes(gameState)}>หยุด</Button>
          </Stack>
          <Box sx={{ mt: 3, p: 2, background: '#f5f5f5', borderRadius: 3, textAlign: 'center', minHeight: '60px' }}>
            <Typography variant="h6" color="secondary">คำที่พูดล่าสุด: <span style={{color: '#ff8f00', fontWeight: 'bold'}}>{transcript}</span></Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default RhythmGame;