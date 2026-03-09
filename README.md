# WhereMiklat 🇮🇱

**Find the nearest bomb shelter in Israel instantly**

A critical safety Progressive Web App (PWA) that helps Israelis locate the closest shelter (מקלט) during emergency situations.

## Features

- 🎯 **One-tap shelter finding** - GPS → nearest shelter → navigation
- 📱 **Progressive Web App** - Install on mobile devices
- 🌐 **Works offline** - Cached shelter data and app functionality
- 📍 **Real-time distance** - Accurate distance calculation in meters/kilometers
- 🧭 **Instant navigation** - Direct integration with Waze and Google Maps
- 🌍 **Hebrew RTL support** - Proper right-to-left layout and Hebrew text
- ⚡ **Emergency optimized** - Fast loading, minimal interface, urgent design

## Technology Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Maps**: GovMap Israel API for official shelter data
- **Geolocation**: HTML5 Geolocation API with coordinate conversion (EPSG:4326 ↔ EPSG:3857)
- **PWA**: Service Worker, Web App Manifest, offline functionality
- **Deployment**: Vercel serverless functions for CORS proxy

## API Integration

Uses the official Israeli GovMap API:
- **Endpoint**: `https://www.govmap.gov.il/api/layers-catalog/entitiesByPoint`
- **Layer ID**: 417 (bomb shelters)
- **Auto-retry logic**: Progressive tolerance (2km → 5km)
- **CORS handling**: Vercel serverless function proxy

## Development

```bash
# Local development with CORS proxy
python3 cors_proxy.py  # Port 8001
python3 -m http.server 8000  # Port 8000

# Access app
open http://localhost:8000
```

## Deployment

Deploy to Vercel for production HTTPS (required for mobile GPS):

1. Connect GitHub repository to Vercel
2. Deploy automatically with included `vercel.json` configuration
3. Access via custom domain: `wheremiklat.com`

## File Structure

```
├── index.html          # Complete PWA application
├── manifest.json       # PWA configuration
├── sw.js              # Service worker for offline functionality
├── api/proxy.js       # Vercel serverless CORS proxy
├── vercel.json        # Deployment configuration
└── package.json       # Project metadata
```

## Emergency Context

This app is designed for **life-critical situations**:
- Optimized for stressed users and emergency conditions
- Large touch targets, clear Hebrew messaging
- Minimal cognitive load, single-purpose design
- Fast performance under poor network conditions

## Contributing

This is a safety-critical application. All contributions must prioritize:
1. **Reliability** over features
2. **Speed** over complexity
3. **Clarity** over customization

## License

MIT License - Built for the safety of Israeli civilians.

---

**במקרה חירום: WhereMiklat.com**