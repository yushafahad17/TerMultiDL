const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const tmp = require('tmp');
const stream = require('stream');
const { promisify } = require('util');

const app = express();
const pipeline = promisify(stream.pipeline);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

app.get('/terms-of-use', (req, res) => {
  res.render('terms-of-use', { title: 'Terms of Use' });
});

app.get('/copyright', (req, res) => {
  res.render('copyright', { title: 'Copyright' });
});

app.get('/privacy-policy', (req, res) => {
  res.render('privacy-policy', { title: 'Privacy Policy' });
});

app.get('/download', async (req, res) => {
  const { url, format } = req.query;
  if (!url || !format) return res.json({ success: false, message: 'Missing parameters' });

  const endpoint = `https://tools-api.aetherzx.xyz/api/aiodl?url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.status !== 200) {
      return res.json({ success: false, message: 'Download data unavailable' });
    }

    const title = data.title?.replace(/[^\w\s]/gi, '') || 'media';
    const thumbnail = data.thumbnail || '';
    const source = data.source || '';

    const isTikTok = source.includes('tiktok.com');
    const isInstagram = source.includes('instagram.com');
    const isFacebook = source.includes('facebook.com');
    const isCapcut = source.includes('capcut.com');
    const isYouTube = source.includes('youtube.com') || source.includes('youtu.be');
    const isSpotify = source.includes('spotify.com');
    const isTwitter = source.includes('twitter.com');

    let videoUrl = null;
    let audioUrl = null;

    if (isTikTok) {
      videoUrl = data.video;
      audioUrl = data.audio;
    } else if (isInstagram || isTwitter) {
      videoUrl = data.video;
    } else if (isFacebook || isCapcut) {
      videoUrl = data.video?.hd || data.video?.sd;
    } else if (isYouTube) {
      videoUrl = source;
    } else if (isSpotify) {
      audioUrl = data.audio;
    }

    if (format === 'mp3') {
      const filename = `${title}_${uuidv4()}.mp3`;

      if (audioUrl) {
        return res.json({
          success: true,
          link: audioUrl,
          title,
          thumbnail,
          format: 'mp3'
        });
      } else if (videoUrl) {
        const tmpIn = tmp.tmpNameSync({ postfix: '.mp4' });
        const tmpOut = tmp.tmpNameSync({ postfix: '.mp3' });

        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error('Failed to download for conversion');

        await pipeline(videoRes.body, fs.createWriteStream(tmpIn));

        ffmpeg(tmpIn)
          .audioCodec('libmp3lame')
          .toFormat('mp3')
          .on('end', () => {
            res.download(tmpOut, filename, (err) => {
              fs.unlinkSync(tmpIn);
              fs.unlinkSync(tmpOut);
            });
          })
          .on('error', (err) => {
            fs.unlinkSync(tmpIn);
            res.status(500).json({ success: false, error: err.message });
          })
          .save(tmpOut);
      } else {
        return res.json({ success: false, message: 'No audio or video source available' });
      }
    } else if (format === 'mp4' && videoUrl) {
      return res.json({
        success: true,
        link: videoUrl,
        title,
        thumbnail,
        format: 'mp4'
      });
    } else {
      return res.json({ success: false, message: 'Invalid format or missing video URL' });
    }

  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

module.exports = app;
