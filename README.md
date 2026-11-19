# Eid Mubarak Website

A modern, responsive Eid wishing website created by Muhammad Rayasat.

## Features

- Animated envelope intro with letter reveal and confetti (returning visitors skip it; "Replay intro" in the footer brings it back)
- Animated hero section with stars and moon — tap the moon, a star, or a floating lantern for sparkle bursts
- Personalized greeting links (`?name=Ayesha`): the hero greets the visitor by name, question 1 is pre-filled, and visitors can copy a link or share on WhatsApp
- Downloadable Eid greeting card (1080×1350 image with the visitor's name; native share sheet on mobile)
- Eid quiz: 5 fun multiple-choice questions with instant feedback, a score screen, and a saved best score
- Interactive questions flow with progress indicator, Back buttons, and a personalized result message
- Media gallery with lightbox preview
- Heartfelt wishes section with animated text
- Confetti animation on envelope open and form submission
- Background music toggle (Eid nasheed) — the button hides itself if the audio file is missing
- Fully responsive design — works on phones from 360px wide, with safe-area-aware buttons and reduced-motion support
- Responses saved to a private GitHub Gist, with a localStorage fallback in the visitor's browser
- Admin dashboard (`admin-responses.html`) to view, refresh, export, and clear responses
- Dark Green, Black, and Gold theme

## Setup

This is a static site — no build step and no dependencies.

1. Open `index.html` in your browser, or run a local server:
   ```bash
   npm run preview
   # then open http://localhost:8000
   ```
2. (Optional) Add an Eid nasheed audio file named `eid-nasheed.mp3` in the same directory for background music. Without it, the music toggle simply stays hidden.

## Structure

- `index.html` - Main HTML structure
- `styles.css` - All styling and animations
- `script.js` - Interactive functionality and animations
- `admin-responses.html` - Admin dashboard for viewing responses
- `e024d61a70376400f8e3a6aca36f87fb.jpg` - Greeting image in the media gallery
- `Mention them  -- Advance Eid Mubarak  -- Happy Eid  -- Eid Mubarak in Advance  -- Mention your favorite person   حوا.mp4` - Eid video in the media gallery

## Responses

When a visitor answers the five questions, their answers are saved to a private GitHub Gist (configured in `script.js`). If the Gist is unreachable, answers fall back to the visitor's own browser localStorage (key `eidResponses`). The admin dashboard reads the same sources, newest first.

## Customization

### Media gallery
Replace `e024d61a70376400f8e3a6aca36f87fb.jpg` / `Mention them  -- Advance Eid Mubarak  -- Happy Eid  -- Eid Mubarak in Advance  -- Mention your favorite person   حوا.mp4` with your own files (keeping the same filenames), or update the `src` attributes in `index.html`.

### Background Music
Add an MP3 file named `eid-nasheed.mp3` to enable background music, or update the audio source in `index.html`:

```html
<audio id="backgroundMusic" loop>
    <source src="your-audio-file.mp3" type="audio/mpeg">
</audio>
```

### Colors
Modify CSS variables in `styles.css`:

```css
:root {
    --dark-green: #0d4d3d;
    --light-green: #1a7a5e;
    --black: #0a0a0a;
    --yellow: #ffd700;
    --gold: #ffb800;
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Credits

Created with love by Muhammad Rayasat
Eid 2026
