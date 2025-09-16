// src/components/RhythmGame.tsx

import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Box, Grid, Paper, Typography, Button, Stack } from '@mui/material';

import { useInterval } from '../hooks/useInterval';
import { allImages, type ImageDataObject } from '../data/imageData';
import BackgroundMusic from '../assets/background-music.mp3';

// --- Constants ---
const TEMPO_BPM = 182;
const TOTAL_IMAGES = 8;
const TOTAL_ROUNDS = 10;
const PRE_GAME_COUNTDOWN = 16;
const INTERMISSION_COUNTDOWN = 8;
const MS_PER_BEAT = (60 / TEMPO_BPM) * 1000;

// Speech Recognition Config
const speechRecognitionOptions = {
  continuous: true,
  interimResults: true,
  language: 'th-TH' // *** CHANGED: Explicitly define Thai language here
};

// --- Helper Functions ---
const shuffleArray = (array: any[]) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// --- Type Definitions ---
type GameState = 'idle' | 'countdown' | 'running' | 'intermission' | 'finished';
type Feedback = 'pending' | 'correct' | 'incorrect';

// --- Component ---
const RhythmGame: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);
  const [countdown, setCountdown] = useState(PRE_GAME_COUNTDOWN);
  const [isBeatOn, setIsBeatOn] = useState(false);

  // Image & Feedback State
  const [gameImages, setGameImages] = useState<ImageDataObject[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [feedback, setFeedback] = useState<Feedback[]>(Array(TOTAL_IMAGES).fill('pending'));

  // Speech Recognition & Audio
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Initial Setup ---
  useEffect(() => {
    audioRef.current = new Audio(BackgroundMusic);
    audioRef.current.loop = true;
    setGameImages(shuffleArray(allImages).slice(0, TOTAL_IMAGES));
  }, []);

  // *** CHANGED: Speech Recognition Keep-Alive Hook (MOST IMPORTANT FIX) ***
  useEffect(() => {
    // If the game is supposed to be active but the microphone has stopped, restart it.
    if (gameState !== 'idle' && gameState !== 'finished' && !listening) {
      console.log("Speech recognition stopped unexpectedly. Restarting...");
      SpeechRecognition.startListening(speechRecognitionOptions);
    }
  }, [listening, gameState]);

  // --- Real-time Speech Checking ---
  useEffect(() => {
    if (gameState !== 'running' || activeIndex < 0 || feedback[activeIndex] === 'correct') return;

    const correctWord = gameImages[activeIndex]?.text;
    // *** CHANGED: Added .trim() to remove whitespace
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

  // --- Main Game Loop ---
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
          if (currentRound >= TOTAL_ROUNDS) { setGameState('finished'); stopGame(); } 
          else {
            setGameImages(shuffleArray(allImages).slice(0, TOTAL_IMAGES));
            setFeedback(Array(TOTAL_IMAGES).fill('pending'));
            setGameState('intermission');
            setCountdown(INTERMISSION_COUNTDOWN);
            setActiveIndex(-1);
          }
        } else { setActiveIndex(nextIndex); }
        break;
    }
  }, gameState !== 'idle' && gameState !== 'finished' ? MS_PER_BEAT : null);

  // --- Control Functions ---
  const startGame = () => {
    setScore(0);
    setCurrentRound(1);
    setFeedback(Array(TOTAL_IMAGES).fill('pending'));
    setGameImages(shuffleArray(allImages).slice(0, TOTAL_IMAGES));
    setActiveIndex(-1);
    resetTranscript();
    setCountdown(PRE_GAME_COUNTDOWN);
    setGameState('countdown');
    SpeechRecognition.startListening(speechRecognitionOptions);
    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
  };

  const stopGame = () => {
    setGameState('idle');
    SpeechRecognition.stopListening();
    if (audioRef.current) { audioRef.current.pause(); }
    setActiveIndex(-1);
  };

  // --- Render ---
  if (!browserSupportsSpeechRecognition) return <Typography color="error">Browser doesn't support speech recognition.</Typography>;
  const getBorderColor = (index: number): string => {
    if (feedback[index] === 'correct') return '#4caf50';
    if (feedback[index] === 'incorrect') return '#f44336';
    if (index === activeIndex) return '#1976d2';
    return 'transparent';
  };
  const isFlashing = (gameState === 'countdown' || gameState === 'intermission') && isBeatOn;

  return (
    <Paper 
      sx={{ 
        width: '100%', maxWidth: '800px', p: 3, borderRadius: 3,
        transition: 'box-shadow 0.1s ease-in-out',
        boxShadow: isFlashing ? '0 0 25px 8px #ffc107' : '4px 4px 10px rgba(0,0,0,0.1)',
      }} 
      elevation={0}
    >
      <Typography variant="h4" gutterBottom textAlign="center">Rhythm Speaking Game</Typography>
      {gameState === 'finished' ? (
        <Box sx={{ textAlign: 'center', my: 4 }}>
          <Typography variant="h5">จบเกม!</Typography>
          <Typography variant="h6">คะแนนสุดท้าย: {score}</Typography>
          <Button variant="contained" onClick={startGame} sx={{mt: 2}}>เล่นอีกครั้ง</Button>
        </Box>
      ) : (
        <>
          <Stack direction="row" justifyContent="space-around" sx={{ my: 2 }}>
            <Typography variant="h6">รอบที่: {currentRound > 0 ? currentRound : '-'} / {TOTAL_ROUNDS}</Typography>
            <Typography variant="h6">คะแนน: {score}</Typography>
          </Stack>
          <Grid container spacing={2}>
            {gameImages.map((item, index) => (
              <Grid size={3} key={`${item.key}-${currentRound}`}>
                <Paper
                  elevation={3}
                  sx={{
                    aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s ease-in-out', border: `5px solid ${getBorderColor(index)}`,
                    transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)',
                    opacity: (gameState === 'running') ? 1 : 0.75,
                  }}
                >
                  <img src={item.image} alt={item.text} style={{ maxWidth: '80%', maxHeight: '80%' }} />
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 3 }}>
            <Button variant="contained" color="primary" onClick={startGame} disabled={gameState !== 'idle'}>เริ่มเกม</Button>
            <Button variant="contained" color="error" onClick={stopGame} disabled={gameState === 'idle' || gameState === 'finished'}>หยุด</Button>
          </Stack>
          <Box sx={{ mt: 2, textAlign: 'center', minHeight: '50px' }}>
            <Typography variant="caption">สถานะ: {listening ? 'กำลังฟัง...' : 'หยุดฟัง'}</Typography>
            <Typography variant="h6" color="primary">คำที่พูดล่าสุด: {transcript}</Typography>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default RhythmGame;