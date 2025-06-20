// src/index.ts
import { app, server } from './app';

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
