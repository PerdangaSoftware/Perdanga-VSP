<div align="center">

<img src="https://i.ibb.co/tPNKHDjV/2026-06-15-012309.png" width="800" alt="Perdanga VSP Header"/> 

# Perdanga VSP (Native Edition)

[![Version](https://img.shields.io/badge/Version-2.0%20Native-000000?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D6?style=flat-square)](#)
[![Tech](https://img.shields.io/badge/C%2B%2B-20-00599C?style=flat-square)](#)
[![Renderer](https://img.shields.io/badge/Render-Direct3D%2011-107C41?style=flat-square)](#)
[![Engine](https://img.shields.io/badge/Core-libmpv-darkred?style=flat-square)](#)
[![Boosty](https://img.shields.io/badge/Support-Boosty-orange?style=flat-square)](https://boosty.to/divizion/donate)

---

> **Perdanga VSP is an native media player that combines pure C++, Direct3D 11 zero-copy video rendering via libmpv, and a modern glassmorphic interface powered by Microsoft Edge WebView2.**

🌐 <a href="https://perdanga-vsp.vercel.app/">perdanga-vsp-landing</a>

</div>

<p align="center">
  <img src="https://i.ibb.co/zTNcw6md/2026-04-24-210131.png" width="800" alt="Main Interface"/>
</p>

<p align="center">
  <b>Media Playlist & Timeline Preview</b><br>
  <img src="https://i.ibb.co/Y7scsRWm/2026-04-26-142943.png" width="800" alt="Playlist Menu"/>
</p>

| Video Frame Preview | Audio & Subtitles |
| :---: | :---: |
| <img src="https://i.ibb.co/dJ293SjW/2026-04-26-142556.png" width="400" alt="Video Frame"> | <img src="https://i.ibb.co/5xS7cY5R/2026-04-26-142250.png" width="400" alt="Audio and Subs"> |

---


## Features

- **Direct3D 11 Native Output:** Video rendered directly into the native Win32 window via `libmpv` with hardware VSync synchronization (`d3d11-sync-interval=1`) and `video-sync=display-resample`.
- **Transparent Glass UI:** Built with HTML5/CSS3 and hardware-accelerated WebView2, featuring blur effects, custom accent colors, and seamless custom window frames.
- **Timeline Frame Scrubbing:** Hovering over the timeline provides millisecond-precise timestamps, frame numbers, chapter tags, and real-time video thumbnails.
- **Single-Instance Win32 Architecture:** Opening files from File Explorer immediately routes them into the active running instance with no duplicate processes.
- **Full Subtitle & Audio Engine:** Switch embedded audio and subtitle tracks on the fly, adjust delay (`-0.1s / +0.1s`), customize vertical positioning, and load external `.srt`/`.vtt`/`.ass` files.

---

## Supported Formats

- **Video Containers:** MP4, MKV, WebM, AVI, MOV, TS, M2TS, FLV, WMV, VOB, and more.
- **Video Codecs:** AV1, HEVC/H.265, H.264/AVC, VP9, VP8, MPEG-2, VC-1, ProRes, etc.
- **Audio Formats:** MP3, FLAC, WAV, AAC, OGG, Opus, M4A, AC3, E-AC3, DTS, ALAC.
- **Subtitles:** ASS/SSA, SRT, WebVTT, PGS, VobSub.

---

## ⌨️ Hotkeys & Controls

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `Double Click` | Toggle Fullscreen |
| `<` / `>` (`,`, `.`) | Adjust Playback Speed (-/+ 0.05x) |
| `Left` / `Right` | Smooth Seek -/+ 5 Seconds (Accelerates on hold) |
| `Shift` + `Left` / `Right` | Skip to Previous / Next Chapter |
| `PgUp` / `PgDn` | Previous / Next File in Playlist |
| `L` | Toggle Playlist Menu |
| `C` | Toggle Chapters Menu |
| `S` | Take Instant Screenshot (Saved to `Pictures/Perdanga VSP`) |
| `Ctrl` + `+` / `-` | Subtitle Size Scaling |
| `Shift` + `+` / `-` | Subtitle Vertical Position |
| `G` / `H` | Subtitle Sync Timing (-/+ 0.1s) |
| `Mouse Wheel` (over icons) | Adjust Volume, Playback Speed, or Cycle Tracks |
| `Right Click` | Quick Track & Subtitle Selection Menu |
| `Escape` | Exit Fullscreen or Close Active Modal / Panel |

---

## Technology Stack

- **Core Backend:** C++20 (MSVC), Windows API (Win32), OLE / Shell APIs, DWM.
- **Playback & Demuxing:** `libmpv` (C API, Direct3D 11, FFmpeg-based decoders).
- **UI Runtime:** Microsoft Edge WebView2 (Evergreen Runtime, transparent composition).
- **Frontend:** Vanilla JavaScript (ES6+), CSS3 Glassmorphism, Semantic HTML5.
- **Build System:** CMake 3.20+ with NMake Makefiles.
- **Packaging:** Inno Setup 6 (Solid LZMA2 compression).

---

## 📂 Project Structure

```text
Perdanga VSP/
├── CMakeLists.txt          # Root CMake build configuration
├── build.bat               # Fast compilation script
├── make_installer.bat      # 1-click build & Inno Setup packager
├── installer.iss           # Inno Setup installation script & registry associations
│
├── src/                    # C++ Native Core
│   ├── main.cpp            # Win32 host window, WebView2 glue, OLE drag-and-drop
│   ├── mpv_player.h        # libmpv thread-safe wrapper interface
│   ├── mpv_player.cpp      # libmpv engine setup, D3D11 options, IPC event pump
│   └── utils.h             # Unicode converters, path resolution, playlist parser
│
├── ui/                     # Web Frontend
│   ├── index.html          # Application layout and modals
│   ├── styles.css          # Glassmorphism styling and animation
│   ├── renderer.js         # UI logic, timeline controller, and state management
│   ├── bridge.js           # Bidirectional IPC bridge (WebView2 <-> C++)
│   ├── hotkeys.js          # Global keyboard shortcut listeners
│   └── ico/                # Application & media icons
│
└── libmpv/                 # libmpv SDK
    ├── include/mpv/        # C header files (client.h, etc.)
    ├── lib/                # Import library (mpv.lib)
    └── libmpv-2.dll        # Dynamic runtime library
```

---

### Prerequisites

1. **Windows 10 / 11 (64-bit)**
2. **Visual Studio 2022 / 2026** (or Build Tools) with the **"Desktop development with C++"** workload.
3. **CMake 3.20 or newer** (usually included with Visual Studio).
4. **Inno Setup 6** (Required only for building the installer: `winget install JR.InnoSetup`).

---

### Step-by-Step Build Guide

#### 1. Obtain `libmpv` Development Files
Make sure the `libmpv` folder in the root directory contains the necessary headers and libraries:
```text
libmpv/
├── include/
│   └── mpv/
│       └── client.h
├── lib/
│   └── mpv.lib (or libmpv.lib)
└── libmpv-2.dll
```

#### 2. Compile the Application
1. Open **x64 Native Tools Command Prompt for VS**.
2. Navigate to the project root directory:
   ```cmd
   cd "C:\Path\To\Perdanga VSP"
   ```
3. Run the automated build script:
   ```cmd
   build.bat
   ```
*The compiled native executable will be located at `build\PerdangaVSP.exe`.*

---

### 📦 Creating the Installer

To compile the application and package it into a self-contained setup wizard:

```cmd
make_installer.bat
```

---

<br>

<div align="center">
  <img src="ui/ico/perdangavsp.ico" width="120" alt="Perdanga VSP Logo"/> 
  <br><br>
  <h2>Perdanga Forever!</h2>
</div>