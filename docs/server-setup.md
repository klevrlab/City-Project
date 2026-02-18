# Server Setup Guide

## Quick Local HTTPS Server

AR.js requires HTTPS for camera and GPS permissions. Here are several options:

### Option 1: Python HTTPS Server (Simplest)

```bash
# Generate self-signed certificate (one-time setup)
openssl req -new -x509 -keyout server.pem -out server.pem -days 365 -nodes

# Start HTTPS server
python3 -m http.server 8443 --bind 0.0.0.0
```

Then access via: `https://YOUR_LOCAL_IP:8443/marker-demo.html`

**Note**: You'll need to accept the self-signed certificate warning on your phone.

### Option 2: ngrok (Easiest for Mobile Testing)

```bash
# Install ngrok: https://ngrok.com/download

# Start local server first
python3 -m http.server 8000

# In another terminal, create HTTPS tunnel
ngrok http 8000
```

ngrok will provide an HTTPS URL like `https://abc123.ngrok.io` that you can access from any device.

### Option 3: GitHub Pages (Best for Demos)

1. Create a GitHub repository
2. Push your HTML files
3. Enable GitHub Pages in repository settings
4. Access via `https://yourusername.github.io/repo-name/`

### Option 4: Netlify Drop (Instant Deploy)

1. Go to https://app.netlify.com/drop
2. Drag and drop your `sharks-way-ar` folder
3. Get instant HTTPS URL

## Finding Your Local IP

### macOS/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

### Windows:
```bash
ipconfig
```

Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)

## Mobile Testing Checklist

### iOS Safari:
1. ✅ HTTPS URL
2. ✅ Allow camera access when prompted
3. ✅ Allow location access (for location-tour.html)
4. ✅ Enable "Motion & Orientation Access" in Safari settings
5. ✅ Turn on Location Services in iOS Settings

### Chrome Android:
1. ✅ HTTPS URL
2. ✅ Allow camera access when prompted
3. ✅ Allow location access (for location-tour.html)
4. ✅ Enable "High accuracy" GPS in Android Settings
5. ✅ Calibrate compass (wave phone in figure-8)

## Troubleshooting

### "Camera not accessible"
- Ensure you're using HTTPS
- Check browser permissions
- Try reloading the page

### "GPS not working"
- Enable Location Services
- Enable high accuracy mode
- Go outdoors for better GPS signal
- Wait 30-60 seconds for GPS lock

### "AR objects not appearing"
- For marker demo: ensure good lighting on the marker
- For location tour: check if you're within 1km of tour stops
- Calibrate compass by waving phone in figure-8
- Try reloading the page

### "Compass pointing wrong direction" (Android)
- Open Google Maps
- Calibrate compass by following on-screen instructions
- Return to AR app

## Testing Without Going to Real Locations

For development, you can temporarily modify the coordinates in `location-tour.html` to match your current location:

1. Get your current GPS coordinates (use Google Maps)
2. Edit the `gps-entity-place` latitude/longitude values
3. Set stops within 50-200m of your location
4. Test the route guidance and distance calculations

## Performance Tips

- Close other apps to free up memory
- Ensure good lighting for camera tracking
- Keep phone steady when scanning markers
- For location AR, stay outdoors with clear sky view
