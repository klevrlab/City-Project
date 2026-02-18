# Sharks Way AR Tour - Super Bowl LX

AR-powered tour guide featuring Sharkey discovering San Jose during Super Bowl LX 2026.

## Quick Start

### Marker-Based Demo
```bash
python3 -m http.server 8000
```
Open: `http://localhost:8000/marker-demo.html`

**Requirements:**
- Print the custom shark marker or use Hiro marker
- Point camera at marker to see AR shark

### Location-Based Tour
Open: `http://localhost:8000/location-tour.html`

**Requirements:**
- HTTPS hosting (for GPS permissions)
- Mobile device with GPS + compass
- Allow location permissions

## Files

- `marker-demo.html` - Marker-based AR demo with custom shark pattern
- `location-tour.html` - GPS-based AR tour with multiple shark locations
- `shark-locations.json` - GPS coordinates and data for all shark placements
- `pattern-shark.patt` - Custom shark marker pattern
- `plushie_shark.glb` - 3D shark model
- `dummy-events.json` - Event data for demos

## Documentation

See `/docs` folder for detailed setup instructions and guides.

## Tech Stack

- AR.js (marker + location-based AR)
- A-Frame (3D rendering)
- Mapbox GL JS (mapping - coming soon)
- Vanilla JavaScript

## Architecture

### JSON-Based Shark Placement
All shark locations are managed in `shark-locations.json`:
- 5 sharks across San Jose (SAP Center, Downtown, San Pedro Square, City Hall, Convention Center)
- Each shark has GPS coordinates, title, description, event info, and Sharkey message
- Easy to add/remove/modify locations without touching code

### Dynamic Loading
`location-tour.html` dynamically creates AR shark entities from JSON:
- Fetches shark-locations.json on load
- Creates A-Frame entities programmatically
- Fallback to default locations if JSON fails

## Current Status

✅ **Completed:**
- Marker-based AR with custom shark pattern
- Location-based AR with JSON data source
- 5 shark locations across San Jose
- Dynamic shark entity creation
- Glass morphism UI with SJ Sharks branding
- Mobile responsive design

## Next Steps

- [ ] Add Mapbox map overlay
- [ ] Implement gamification (collection tracker)
- [ ] Add navigation between shark locations
- [ ] Marker unlock → GPS mode hybrid system
