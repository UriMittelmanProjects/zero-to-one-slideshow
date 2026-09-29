# Zero to One slideshow

A standalone GitHub Pages slideshow of the fixed 83-photo Zero to One Startup-a-thon collection.

## Playback

- Autoplays at 3 seconds per photo. All 83 photos are included by default.
- Loops by default; turn off Loop slideshow to hold the last included photo at the end.
- Fade (default), cut, or slide transitions.
- Optional slow zoom in/out and horizontal or vertical pan. Both are off by default.
- Choose photos to skip, or use Skip this photo. Skipping is playback selection, not deletion.
- Reset restores the exact defaults and restarts at photo 1.
- Pause/play, previous/next, fullscreen, and keyboard shortcuts (Space, arrows, F).
- Hide controls clears the photo display, including the progress bar. Moving the mouse restores controls; touch users can tap the photo, and keyboard users can press any key. This works both inline and in fullscreen, without changing playback.
- Playback pauses while the photo picker or a background tab is open. Photos load before their display timer starts.
- Settings are session-only; reloading starts with the specified defaults.

The application has no image upload, import, delete, or external-image URL feature. Its frozen manifest contains exactly 83 bundled images. Repository owners can of course edit source code; the web application's controls cannot change the collection.

## Photos

`docs/photos.js` maps every bundled photo to its original filename. All 83 images are optimized WebP copies, up to 2560 pixels on the long edge, with separate thumbnails. The original full-resolution JPEG collection is preserved locally outside this repository. No third-party photo URLs, fonts, libraries, analytics, or account credentials are used by the site.

## Develop and test

No installation or build is required. With Python and Node.js installed:

```sh
python -m http.server 8765 --directory docs
npm test
npm run check
```

Open http://localhost:8765. GitHub Pages publishes the `docs` directory on the `main` branch. `.nojekyll` makes it a plain static site. Relative asset paths support a GitHub Pages project URL.
