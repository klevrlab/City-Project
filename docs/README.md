# Sharks Way AR Tour Guide - Phase I

## Overview
AR.js-based tour guide featuring Sharkey as the guide for S26 Events.


### 1. QR/Marker-Based (Quick Demo)
- **File**: `marker-demo.html`
- **Trigger**: Hiro marker (printable)
- **Works**: Indoors/outdoors, no GPS needed
- **Best for**: Controlled demos, stakeholder presentations

### 2. Location-Based (Phase I Final)
- **File**: `location-tour.html`
- **Trigger**: GPS + compass
- **Features**: Route guidance with map + AR directional arrows
- **Best for**: Real outdoor tour experience

## Setup Requirements

### Both versions require:
- **HTTPS hosting** (camera/GPS permissions)
- Mobile device with camera
- Modern browser (Safari iOS / Chrome Android)

### Location-based additionally needs:
- GPS enabled + high accuracy mode
- Compass calibration
- Accelerometer + magnetometer sensors
- **Note**: Won't work on Firefox (compass limitation)

## Quick Start

### Marker Demo
1. Print Hiro marker: https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png
2. Serve `marker-demo.html` over HTTPS
3. Point camera at marker

### Location Tour
1. Serve `location-tour.html` over HTTPS
2. Allow camera + location permissions
3. Enable high accuracy GPS
4. Calibrate compass (wave phone in figure-8)
5. Walk to tour stops

## Dummy Event Data
Currently using hardcoded events:
- The Big Game (SAP Center)
- March Madness (Downtown SJ)
- World Cup Watch Party (San Pedro Square)

## Testing
- iOS Safari: Recommended for location AR
- Chrome Android: Works but may need compass calibration
- Desktop: Camera preview only, no GPS

## Next Steps
- Replace dummy data with real event API
- Add more tour stops
- Enhance Sharkey 3D model
- Improve route guidance UX
