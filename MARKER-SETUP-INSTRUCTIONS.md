# 🦈 Custom Shark Marker Setup Guide

## Quick Steps:

### 1. Save Your Shark Image
Save the shark image (the one with teal/blue shark on concrete) to:
```
/Users/spartan/Documents/Immersion 2026/sharks-way-ar/custom-shark-marker.png
```

### 2. Generate AR Marker Pattern

**Option A: Online Generator (Easiest)**
1. Go to: https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html
2. Click "Choose File" and upload your `custom-shark-marker.png`
3. Download the generated files:
   - `pattern-marker.patt` (rename to `pattern-shark.patt`)
   - `marker.png` (this is what you'll print/display)

**Option B: Use AR.js NFT Marker Creator**
1. Go to: https://carnaux.github.io/NFT-Marker-Creator/
2. Upload your shark image
3. Download the generated `.fset`, `.fset3`, `.iset` files
4. Place them in the sharks-way-ar folder

### 3. Update the Code

In `marker-demo-custom.html`, change line 73 from:
```html
<a-marker preset="hiro" id="custom-marker" class="clickable">
```

To:
```html
<a-marker type="pattern" url="./pattern-shark.patt" id="custom-marker" class="clickable">
```

### 4. Test It!

1. Start your server: `python3 -m http.server 8000`
2. Open: `http://localhost:8000/marker-demo-custom.html`
3. Print or display the `marker.png` file you downloaded
4. Point your camera at it!

## What You'll Get:

- ✅ Your custom shark image as the AR trigger
- ✅ 3-second persistence after marker is lost
- ✅ Plushie shark 3D model appears above your custom marker

## Troubleshooting:

**If marker doesn't work:**
- Make sure the image has good contrast
- Ensure the marker is well-lit
- Keep the marker flat and steady
- Try increasing the marker size when printing

**Pattern vs NFT:**
- **Pattern Marker**: More reliable, faster, works on all devices (recommended)
- **NFT Marker**: Uses exact image, but requires more processing power

## Alternative: Keep Using Hiro Marker

If you want to stick with the Hiro marker but just have the 3-second persistence, use the updated `marker-demo.html` - it already has the 3-second delay implemented!

---

**Current Status:**
- ✅ 3-second persistence: DONE (in marker-demo.html)
- ⏳ Custom marker: Waiting for pattern file generation
