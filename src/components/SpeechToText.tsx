import React from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

// Import MUI Components
import { Button, Typography, Paper, Stack, Box, CircularProgress } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RefreshIcon from '@mui/icons-material/Refresh';

const SpeechToText: React.FC = () => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  if (!browserSupportsSpeechRecognition) {
    return <Typography color="error">เบราว์เซอร์ของคุณไม่รองรับการแปลงเสียงเป็นคำพูด</Typography>;
  }

  const startListening = () => {
    // ตั้งค่าให้ฟังต่อเนื่องและเป็นภาษาไทย
    SpeechRecognition.startListening({ continuous: true, language: 'th-TH' });
  };

  return (
    <Paper elevation={3} sx={{ padding: 4, borderRadius: 2, width: '100%', maxWidth: '600px' }}>
      <Stack spacing={3}>
        <Typography variant="h5" component="h1" textAlign="center">
          แปลงเสียงเป็นคำพูดแบบ Real-time
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <Typography variant="body1">
            สถานะไมโครโฟน:
          </Typography>
          {listening ? (
            <>
              <Typography color="success.main">กำลังฟัง...</Typography>
              <CircularProgress size={20} color="success" />
            </>
          ) : (
            <Typography color="text.secondary">หยุดฟัง</Typography>
          )}
        </Box>

        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="contained"
            color="primary"
            startIcon={<MicIcon />}
            onClick={startListening}
            disabled={listening}
          >
            Start
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<MicOffIcon />}
            onClick={SpeechRecognition.stopListening}
            disabled={!listening}
          >
            Stop
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetTranscript}
          >
            Reset
          </Button>
        </Stack>
        
        <Paper variant="outlined" sx={{ p: 2, minHeight: '150px', backgroundColor: '#f5f5f5' }}>
            <Typography variant="body1">
            {transcript || <span style={{ color: '#999' }}>คำพูดของคุณจะปรากฏที่นี่...</span>}
            </Typography>
        </Paper>
      </Stack>
    </Paper>
  );
};

export default SpeechToText;