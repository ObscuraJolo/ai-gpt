import axios from 'axios';
import express from 'express';
import FormData from 'form-data';
import fs from 'fs';
import http from 'http';
import { getData } from './controllers/open-ai.controller.js';

import config from './api.json' assert { type: 'json' };

import { dirname } from 'path';
import { fileURLToPath } from 'url';
const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

const currentUrl = import.meta.url;
const currentPath = dirname(fileURLToPath(currentUrl));

app.use('/', express.static(currentPath));

const server = http.createServer(app);

app.get('/home', (req, res) => {
  res.status(200).json({
    message: 'Home',
  });
});

// Generate Voice - 11 Eleven Studio
app.post('/api/eleven-studio', async (req, res) => {
  const text = req.body.text;

  try {
    const response = await axios.post(
      // `${config.url_eleven}/${'pWbdUMnJkgi5Dc5Yd7GZ'}`, // Eugene
      `${config.url_eleven}/${config.voice_id}`, // Brock
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          'content-type': 'application/json',
          accept: 'audio/mpeg',
          'xi-api-key': config.key_eleven,
        },
        responseType: 'stream',
      }
    );
    if (response.status === 200) {
      const filePath = './eleven-studio/output/generated.mp3';
      response.data.pipe(fs.createWriteStream(filePath));
      console.log('File saved successfully');
      res.status(200).json({ message: 'Successfully saved file' });
    } else {
      console.log('Error failed to retrieve the file');
      res
        .status(500)
        .json({ error: 'Failed to retrieve from Eleven Studio API' });
    }
  } catch (err) {
    console.error('Error: ', err);
    res
      .status(500)
      .json({ error: 'Failed to retrieve from Eleven Studio API' });
  }
});

const generateMP3 = () => {
  return new Promise((resolve, reject) => {
    // Generate the MP3 file
    // ...

    // Simulating a delay for demonstration purposes
    setTimeout(() => {
      const filePath = './eleven-studio/output/generated.mp3';
      resolve(filePath);
    }, 5000); // Replace this with your actual MP3 generation code
  });
};

// Generate Voice - 11 Eleven Studio
app.post('/api/d-id/upload/audio', async (req, res) => {
  try {
    const filePath = await generateMP3();
    const audioFile = fs.createReadStream(filePath);
    const form = new FormData();
    form.append('audio', audioFile, 'generated.mp3');

    const response = await axios.post(`${config.url}/audios`, form, {
      timeout: 600000,
      headers: {
        authorization: `Basic ${config.key}`,
        'content-type': 'multipart/form-data',
        accept: 'application/json',
        ...form.getHeaders(),
      },
    });

    console.log('D-ID Upload Status: ' + JSON.stringify(response.data));
    res.status(201).json(response.data);
  } catch (err) {
    console.error('Error: ', err);
    res.status(500).json({
      error: 'Failed to retrieve from D-ID Studio API',
    });
  }
});

app.post('/openai', getData);

app.listen(PORT, () => {
  console.log(`[server] Now listening to http://localhost:${PORT}`);
});
