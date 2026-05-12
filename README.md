# Sharks Way — Immersion 2026

WebAR platform for the Sharks Way corridor between downtown San José and SAP Center, built by SJSU students and faculty as part of **Immersion 2026**.

## About Immersion 2026

Immersion 2026 is a multi-phase augmented reality (AR) public art experience connecting San José State University, downtown San José, and major cultural events. The web-based AR platform links SJSU, City Hall, SAP Center, and downtown districts through animated AR public art and murals, interactive selfies with mascots and characters, and location-based storytelling and event activations — no app required.

Built by SJSU students under the guidance of faculty in collaboration with the City of San José Downtown Business Association and the City of San José Office of Cultural Affairs, the project transforms sidewalks, murals, and public spaces into interactive digital storytelling environments.

## About Sharks Way

Sharks Way is part of the larger **Stitching Districts** initiative, a collaboration between the San Jose Downtown Association, artist Jimmy Paints, the City of San José Office of Cultural Affairs, San José State University, the San Jose Sharks, and community partners. Artist-painted sharks line the sidewalk along the corridor, "swimming" toward SAP Center to create a playful visual path.

Visitors scan a shark or QR code with their phone to unlock animated digital content, wayfinding, maps, event information, and highlights of public art and neighborhood culture — all in a mobile browser.

The project is proudly supported by **Reimagining the Civic Commons**.

## Quick Start

### Local Development
```bash
python3 -m http.server 8080
```

### Mobile Testing
Access on phone via local IP (same WiFi):
```
http://[YOUR_LOCAL_IP]:8080
```

### Public Tunnel
```bash
npx localtunnel --port 8080
```

## AR Experiences

### 1. Sharks Way (AR.js)
**File:** `sharks-way.html`
**Tech:** TensorFlow.js + MobileNet
AI-powered shark painting detection with the always-on Little Italy shark rotation.

### 2. Sharks Way (8th Wall)
**File:** `sharks-way-8thwall.html`
**Tech:** 8th Wall WebAR + A-Frame
GPS-triggered cycle of six animated shark experiences (Maria Swimmer, Jimmy Swimmer, Sharkie Waving, Diving Shark, Stella Swimmer, Little Italy Patrol).

### 3. Location Tour
**File:** `location-tour.html`
**Tech:** Geolocation API + Leaflet.js
GPS-based checkpoint tracking with interactive map and directional navigation along the Sharks Way corridor.

### 4. Selfie AR
**File:** `selfie-ar.html`
**Tech:** MediaPipe Pose
Shoulder tracking to position Sammy Spartan or Sharkie on the user's shoulder for selfie capture.

### 5. Marker Demo
**File:** `marker-demo.html`
**Tech:** AR.js + A-Frame
Point camera at the marker to see a 3D shark with event info.

## Requirements

- **HTTPS:** Required for camera and GPS access
- **Browser:** iOS Safari 13+ or Android Chrome 80+
- **Permissions:** Camera and location access
- **Network:** ~8MB initial load from CDNs

## Project Structure

```
City-Project/
├── assets/
│   ├── 3D-models/          # GLB files
│   ├── Markers/            # AR patterns
│   ├── SharkLogo.png
│   └── video.mp4
├── data/
│   ├── shark-locations.json
│   └── shark-embeddings-browser.json
├── src/
│   ├── components/         # A-Frame components (animator, detector, tour-ui)
│   ├── systems/            # event-system
│   └── utils/              # GPS, audio, math, embedding helpers
├── index.html              # Landing page
├── marker-demo.html
├── sharks-way.html
├── sharks-way-8thwall.html
├── location-tour.html
├── selfie-ar.html
└── shark-ar-demo.html
```

## Tech Stack

**AR & 3D:** 8th Wall WebAR, AR.js, A-Frame, model-viewer, Three.js
**AI:** TensorFlow.js, MobileNet v2, MediaPipe Pose
**Maps:** Leaflet.js, Geolocation API, Haversine formula
**Frontend:** Vanilla JavaScript, CSS3, HTML5

## March 2026 Activations

- **Free Throw at SAP Center** — Mar 26 & 28, 2026 · 7:30 PM – 10:00 PM
  Projection mapping at SAP Center by G. Craig Hobbs with students from SJSU's CADRE Media Lab. A San Jose Sports Authority + City of San José + SJSU + SAP Center collaboration.
- **Minis & Trophy at Arena Green West** — Mar 26 & 28, 2026 · 1:00 PM – 10:00 PM
  Portable interactive light sculptures by SJSU Professor Esteban Garcia Bravo with the CADRE Media Lab, Digital Media Art, and Spatial Art programs.
- **International Football – Watch Together** — Jun–Jul 2026 · San Pedro Square Market

## Credits

**Faculty Leads:** Rhonda Holberton (Associate Professor, Art & Art History, SJSU) · Marjan Khatibi (Assistant Professor of Design, SJSU) · Lacey Nein (Emerging Technology Lab Coordinator, SJSU)

**Student Team:** Chris Velez · Maria (Phuong-Trang) Vu · Ganesh Nagavenkatasai Mohan Kancherla · Antony Cucina · Sean Cruz-Colatriano · Andrea Oppliger-Delgado · Tharun Chunchu

## Documentation

- `ARCHITECTURE.md` — System design and data flow
- `DEPLOYMENT.md` — Setup and hosting guide

---

**Version:** 2.0
**Immersion 2026** — SJSU CADRE + KLEVR Labs · San José, CA
