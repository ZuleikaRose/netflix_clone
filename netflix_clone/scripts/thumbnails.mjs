// Draws the seek-preview thumbnails in public/media/ (<clip>.thumbs.jpg) from each sample clip:
//   node scripts/thumbnails.mjs
// One frame every THUMBS.every seconds, fitted (letterboxed) into THUMBS.width × THUMBS.height, in rows of
// THUMBS.columns. The player
// (components/Player.jsx) finds a time's frame from the same numbers in data/clips.js. Chromium only plays the WebM.
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { THUMBS, clips } from '../src/data/clips.js'

const PORT = 4198
const server = spawn(process.execPath, ['e2e/serve.js', 'public', String(PORT)], { stdio: 'ignore' })
await new Promise((resolve) => setTimeout(resolve, 500))

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  // Any page on the server, so the video is same-origin and the canvas can be read back
  await page.goto(`http://localhost:${PORT}/media/${clips[0].id}.en.vtt`)
  for (const clip of clips) {
    const dataUrl = await page.evaluate(async ({ src, every, width, height, columns }) => {
      const video = document.createElement('video')
      video.muted = true
      video.src = src
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve
        video.onerror = () => reject(new Error(`Couldn't load ${src}`))
      })
      const count = Math.ceil(video.duration / every)
      const canvas = document.createElement('canvas')
      canvas.width = width * Math.min(columns, count)
      canvas.height = height * Math.ceil(count / columns)
      const context = canvas.getContext('2d')
      context.fillStyle = '#000'
      context.fillRect(0, 0, canvas.width, canvas.height)
      // The clips are wider than 16:9 (or narrower), so each frame keeps its shape inside its slot
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight)
      const [w, h] = [video.videoWidth * scale, video.videoHeight * scale]
      for (let i = 0; i < count; i++) {
        // The middle of each slot, so the frame matches what plays around that time
        video.currentTime = Math.min(video.duration - 0.05, i * every + every / 2)
        await new Promise((resolve) => { video.onseeked = resolve })
        context.drawImage(video, (i % columns) * width + (width - w) / 2, Math.floor(i / columns) * height + (height - h) / 2, w, h)
      }
      return canvas.toDataURL('image/jpeg', 0.7)
    }, { src: `/media/${clip.id}.webm`, ...THUMBS })
    const path = `public/media/${clip.id}.thumbs.jpg`
    await writeFile(path, Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log(path)
  }
} finally {
  await browser.close()
  server.kill()
}
