// src/App.tsx

import RhythmGame from './components/RhythmGame';
import { CssBaseline, Container, Box } from '@mui/material';

function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <RhythmGame />
        </Box>
      </Container>
    </>
  );
}

export default App;