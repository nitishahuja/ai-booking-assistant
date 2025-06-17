// src/app.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (_req, res) => {
  res.send('🩺 AI Booking Assistant API is up and running!');
});

export default app;
