# Top-up Fuel - Installation Instructions

## 📱 Install on Android Phone

### Method 1: Direct Install (Recommended)
1. **Download all files** to your phone or computer
2. **Upload to a web server** or GitHub Pages (free hosting)
3. **Open in Chrome** on your Android phone
4. **Tap the menu** (three dots) → "Add to Home screen"
5. **Done!** The app icon will appear on your home screen

### Method 2: Local Testing (Using a Computer)
1. **Download all files** to a folder on your computer
2. **Start a local web server**:
   ```bash
   # If you have Python installed:
   python3 -m http.server 8000
   
   # Or use Node.js:
   npx serve
   ```
3. **Find your computer's IP address**:
   - Windows: `ipconfig` in Command Prompt
   - Mac/Linux: `ifconfig` or `ip addr`
4. **On your phone**, open Chrome and go to:
   `http://YOUR_COMPUTER_IP:8000`
5. **Install** using Chrome's menu → "Add to Home screen"

### Method 3: GitHub Pages (Free Hosting)
1. Create a GitHub account (free)
2. Create a new repository
3. Upload all files from the outputs folder
4. Enable GitHub Pages in repository settings
5. Visit the provided URL on your Android phone
6. Install using Chrome → "Add to Home screen"

## 📂 Required Files
Make sure all these files are in the same folder:
- `index.html` - Main app file
- `cycling-nutrition-app.jsx` - App code
- `manifest.json` - App metadata
- `service-worker.js` - Offline support
- `icon-192.png` - App icon (small)
- `icon-512.png` - App icon (large)

## ✨ Features After Installation
- **Works offline** - Use during rides without internet
- **Full-screen mode** - No browser UI distractions
- **Home screen icon** - Launch like a native app
- **Bluetooth access** - Connect to HR monitors
- **Voice alerts** - Spoken fueling reminders
- **Wake lock** - Screen stays on during rides

## 🔋 Battery Optimization
To prevent Android from killing the app during rides:
1. Go to Settings → Apps → Top-up Fuel
2. Battery → Unrestricted battery usage
3. This ensures the app stays active during long rides

## 🎯 First Time Setup
1. **Grant permissions** when prompted:
   - Microphone (for voice alerts)
   - Location (optional, for future GPS features)
   - Bluetooth (for HR monitor)
2. **Connect HR monitor** (optional)
3. **Enter your weight** and ride intensity
4. **Start riding!**

## 📱 Bluetooth HR Monitor Setup
1. Turn on your HR monitor (chest strap or armband)
2. In the app, tap "Connect via Bluetooth"
3. Select your device from the list
4. Grant Bluetooth permission if prompted
5. Connection confirmed when you see "Connected"

## 🆘 Troubleshooting

**App won't install:**
- Make sure you're using Chrome browser (not Samsung Internet or Firefox)
- Check that all files are accessible via HTTPS or localhost

**Voice alerts not working:**
- Enable microphone permission in Chrome
- Turn off Silent Mode on your phone
- Increase media volume

**Bluetooth won't connect:**
- Enable Bluetooth permission in Chrome settings
- Make sure your HR monitor is in pairing mode
- Try refreshing the page and reconnecting

**App closes during ride:**
- Disable battery optimization for Chrome
- Keep screen on (the app will prevent auto-sleep)
- Close other battery-intensive apps

## 💡 Pro Tips
- Test voice alerts before starting your ride
- Keep phone plugged into external battery pack for long rides
- Mount phone where you can easily tap "Mark as Consumed"
- Pre-load the app before leaving WiFi for best performance

## 🔄 Updates
To update the app:
1. Visit the web URL again
2. The service worker will auto-update cached files
3. Refresh the page if changes don't appear immediately

---

**Need help?** Check that all files are in the same directory and accessible via a web server.
