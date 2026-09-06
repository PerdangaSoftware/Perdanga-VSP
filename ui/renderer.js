// --- 0. WINDOW CONTROLS & TITLEBAR ---
document.getElementById('win-minimize').addEventListener('click', () => window.electronAPI.windowMinimize());

const winMaximizeBtn = document.getElementById('win-maximize');
const maxIcon = winMaximizeBtn.querySelector('.max-icon');
const restoreIcon = winMaximizeBtn.querySelector('.restore-icon');

winMaximizeBtn.addEventListener('click', () => window.electronAPI.windowMaximize());
document.getElementById('win-close').addEventListener('click', () => window.electronAPI.windowClose());

window.electronAPI.onWindowMaximizeState((isMaximized) => {
    maxIcon.style.display = isMaximized ? 'none' : 'block';
    restoreIcon.style.display = isMaximized ? 'block' : 'none';
    winMaximizeBtn.title = isMaximized ? "Restore" : "Maximize";
    document.body.classList.toggle('maximized', isMaximized);
});

window.electronAPI.onFullscreenState((isFullscreen) => {
    document.body.classList.toggle('fullscreen', isFullscreen);
});

// --- 1. DOM ELEMENTS & STATE ---
const playerContainer = document.getElementById('playerContainer');
const videoClickSurface = document.getElementById('videoClickSurface');
const emptyState = document.getElementById('emptyState');
const audioVisualizer = document.getElementById('audioVisualizer');
const pulseRing = document.querySelector('.audio-pulse-ring');
const fileInput = document.getElementById('fileInput');

const mainLogo = document.getElementById('mainLogo');
const audioLogo = document.getElementById('audioLogo');

const osdAlert = document.getElementById('osdAlert');
const osdTitle = document.getElementById('osdTitle');
const osdMain = document.getElementById('osdMain');
const osdSub = document.getElementById('osdSub');

const seekOverlay = document.getElementById('seekOverlay');
const seekArrows = document.getElementById('seekArrows');
const seekText = document.getElementById('seekText');

const npFilename = document.getElementById('npFilename');
const npPlaylistInfo = document.getElementById('npPlaylistInfo');

const playlistPanel = document.getElementById('playlistPanel');
const playlistItemsContainer = document.getElementById('playlistItems');
const closePlaylistBtn = document.getElementById('closePlaylistBtn');
const playlistBtn = document.getElementById('playlistBtn');

const chaptersPanel = document.getElementById('chaptersPanel');
const chaptersItemsContainer = document.getElementById('chaptersItems');
const closeChaptersBtn = document.getElementById('closeChaptersBtn');
const chaptersBtn = document.getElementById('chaptersBtn');

const navTogglesBlock = document.getElementById('navTogglesBlock');
const navTogglesDivider = document.getElementById('navTogglesDivider');
const navTogglesSeparator = document.getElementById('navTogglesSeparator');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');

const loopBtn = document.getElementById('loopBtn');
const loopAllIcon = document.getElementById('loopAllIcon');
const loopOneIcon = document.getElementById('loopOneIcon');
let loopMode = 0; // 0 = Off, 1 = Playlist, 2 = Single File

const progressWrapper = document.getElementById('progressWrapper');
const progressBar = document.getElementById('progressBar');
const markersContainer = document.getElementById('markersContainer');

const timelineTooltip = document.getElementById('timelineTooltip');
const thumbContainer = document.getElementById('thumbContainer');
const thumbVideo = document.getElementById('thumbVideo');
const thumbText = document.getElementById('thumbText');

const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const volumeWrap = document.getElementById('volumeWrap');
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('muteBtn');
const volUpIcon = document.getElementById('volUpIcon');
const volMuteIcon = document.getElementById('volMuteIcon');
const fullscreenBtn = document.getElementById('fullscreenBtn');

const speedWrap = document.getElementById('speedWrap');
const speedBtn = document.getElementById('speedBtn');
const speedLabel = document.getElementById('speedLabel');
let userPlaybackRate = 1.0;

const audioSwitchBtn = document.getElementById('audioSwitchBtn');
const subSwitchBtn = document.getElementById('subSwitchBtn');
const audioSwitchWrap = document.getElementById('audioSwitchWrap');
const subSwitchWrap = document.getElementById('subSwitchWrap');

const loadSubBtn = document.getElementById('loadSubBtn');
const subInput = document.getElementById('subInput');

const audioTrackCount = document.getElementById('audioTrackCount');
const subTrackCount = document.getElementById('subTrackCount');

const contextMenu = document.getElementById('contextMenu');
const contextAudioList = document.getElementById('contextAudioList');
const contextSubList = document.getElementById('contextSubList');
const ctxLoadSub = document.getElementById('ctxLoadSub');

const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

const appIconSelect = document.getElementById('appIconSelect');
const accentColorPicker = document.getElementById('accentColorPicker');
const subSizeSlider = document.getElementById('subSizeSlider');
const subPosSlider = document.getElementById('subPosSlider');
const glowToggle = document.getElementById('glowToggle');
const chaptersToggle = document.getElementById('chaptersToggle');
const timelineOpacitySlider = document.getElementById('timelineOpacitySlider');
const timelineBlurSlider = document.getElementById('timelineBlurSlider');

const openHotkeysBtn = document.getElementById('openHotkeysBtn');
const hotkeysModal = document.getElementById('hotkeysModal');
const closeHotkeysBtn = document.getElementById('closeHotkeysBtn');

let uiTimeout;
let osdTimeout;
let currentFilePath = '';
let isVideoLoaded = false;
let isAudioMode = false;
let isPaused = true;
let chaptersEnabled = true;

let playlist = [];
let playlistIndex = 0;
let activeChapterIndex = -1;

let mpvTrackList = [];
let audioStreams = [];
let subStreams = [];
let mediaChapters = [];
let currentAudioTrack = null;
let currentSubTrack = 'off';
let externalSubId = null;
let subDelay = 0;
let currentFps = 24;

let isScrubbing = false;
let isDraggingVolume = false;

let isAccumulatingSeek = false;
let seekAccumulator = 0;
let seekAccumulatorTimer = null;
let baseSeekTime = 0;
let lastVisualSeekUpdate = 0;

let smoothSeekTarget = 0;
let smoothSeekCurrent = 0;
let smoothSeekRaf = null;

let currentTime = 0;
let mediaDuration = 0;
let isVideoPlayingIntent = false;
let lastSaveTime = 0;
let lastMouseX = -1;
let lastMouseY = -1;
let lastTooltipHTML = '';
let lastThumbUpdate = 0;

let progressCache = null;
let mpvInitialized = false;
let eofHandled = false;
let thumbVideoBroken = false;

let lastTimeStr = '';
let lastProgressBarValue = -1;
let surfaceClickTimer = null;

// --- 2. UTILITY FUNCTIONS ---

const escapeHTML = (str) => {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatDetailedTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00:00.000';
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60), ms = Math.floor((secs % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const formatSeekDelta = (seconds) => {
    const absSecs = Math.round(Math.abs(seconds));
    const h = Math.floor(absSecs / 3600);
    const m = Math.floor((absSecs % 3600) / 60);
    const s = absSecs % 60;
    let parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
};

const showSeekOverlay = (direction, accumulatedSeconds) => {
    if (!seekOverlay.classList.contains('show') || seekOverlay.dataset.dir != direction) {
        seekOverlay.classList.remove('left', 'right');
        seekArrows.className = 'seek-arrows';
        const arrowSvg = direction > 0
            ? `<svg viewBox="0 0 24 24"><path d="M8 6v12l8.5-6L8 6z"/></svg>`
            : `<svg viewBox="0 0 24 24"><path d="M16 18V6l-8.5 6 8.5 6z"/></svg>`;
        seekArrows.innerHTML = arrowSvg + arrowSvg + arrowSvg;
        if (direction > 0) {
            seekOverlay.classList.add('right');
            seekArrows.classList.add('right');
        } else {
            seekOverlay.classList.add('left');
            seekArrows.classList.add('left');
        }
        seekOverlay.classList.add('show');
        seekOverlay.dataset.dir = direction;
    }
    const sign = direction > 0 ? '+' : '-';
    seekText.textContent = `${sign}${formatSeekDelta(accumulatedSeconds)}`;
};

const hideSeekOverlay = () => {
    seekOverlay.classList.remove('show');
    seekOverlay.dataset.dir = '0';
};

const accumulateSeek = (delta) => {
    if (!isVideoLoaded) return;
    const duration = mediaDuration || 0;

    if (isAccumulatingSeek && seekAccumulator !== 0 && Math.sign(delta) !== Math.sign(seekAccumulator)) {
        baseSeekTime = Math.max(0, Math.min(duration, baseSeekTime + seekAccumulator));
        seekAccumulator = 0;
    }

    if (!isAccumulatingSeek) {
        baseSeekTime = currentTime;
        isAccumulatingSeek = true;
        smoothSeekCurrent = baseSeekTime;

        const animateSmoothSeek = () => {
            if (!isAccumulatingSeek) return;
            smoothSeekCurrent += (smoothSeekTarget - smoothSeekCurrent) * 0.35;
            progressBar.value = smoothSeekCurrent;
            smoothSeekRaf = requestAnimationFrame(animateSmoothSeek);
        };
        smoothSeekRaf = requestAnimationFrame(animateSmoothSeek);

        window.mpvAPI.setProperty('pause', true);
    }

    let rawTarget = baseSeekTime + seekAccumulator + delta;
    let targetTime = Math.max(0, Math.min(duration, rawTarget));

    seekAccumulator = targetTime - baseSeekTime;
    smoothSeekTarget = targetTime;

    const now = Date.now();
    if (now - lastVisualSeekUpdate > 80) {
        lastVisualSeekUpdate = now;
        
        const newTimeStr = formatTime(targetTime);
        if (newTimeStr !== lastTimeStr) {
            currentTimeEl.textContent = newTimeStr;
            lastTimeStr = newTimeStr;
        }

        if (seekAccumulator !== 0) {
            const direction = seekAccumulator > 0 ? 1 : -1;
            showSeekOverlay(direction, seekAccumulator);
        } else {
            hideSeekOverlay();
        }
        window.mpvAPI.seek(targetTime, true, false);
    }

    clearTimeout(seekAccumulatorTimer);
    seekAccumulatorTimer = setTimeout(() => {
        isAccumulatingSeek = false;
        cancelAnimationFrame(smoothSeekRaf);

        progressBar.value = targetTime;
        lastProgressBarValue = targetTime; 
        const finalTimeStr = formatTime(targetTime);
        currentTimeEl.textContent = finalTimeStr;
        lastTimeStr = finalTimeStr;
        currentTime = targetTime;

        window.mpvAPI.seek(targetTime, true, true);
        seekAccumulator = 0;
        hideSeekOverlay();

        if (isVideoPlayingIntent) {
            window.mpvAPI.setProperty('pause', false);
        }

        if (!playerContainer.classList.contains('hide-ui')) {
            resetUIHider();
        }
    }, 600);
};

const showOSD = (title, main, sub = '') => {
    osdTitle.textContent = title;
    osdMain.textContent = main;
    osdSub.textContent = sub;
    osdSub.style.display = sub ? 'block' : 'none';
    osdAlert.classList.add('show');
    clearTimeout(osdTimeout);
    osdTimeout = setTimeout(() => {
        osdAlert.classList.remove('show');
    }, 2500);
};

const saveProgress = (time) => {
    const now = Date.now();
    if (currentFilePath && time > 1 && now - lastSaveTime > 3000) {
        if (!progressCache) progressCache = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
        progressCache[currentFilePath] = time;
        const keys = Object.keys(progressCache);
        if (keys.length > 30) delete progressCache[keys[0]];
        localStorage.setItem('perdangaProgress', JSON.stringify(progressCache));
        lastSaveTime = now;
    }
};

const clearProgress = () => {
    if (!progressCache) progressCache = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
    delete progressCache[currentFilePath];
    localStorage.setItem('perdangaProgress', JSON.stringify(progressCache));
};

const takeScreenshot = async () => {
    if (!isVideoLoaded || isAudioMode) {
        showOSD('SCREENSHOT', 'Video required for screenshot');
        return;
    }
    try {
        const baseName = currentFilePath ? currentFilePath.split('\\').pop().split('/').pop().replace(/\.[^/.]+$/, '') : 'screenshot';
        const timeStr = formatDetailedTime(currentTime).replace(/:/g, '-').replace('.', '-');
        const filename = `${baseName}_${timeStr}.png`;
        const screenshotPath = await window.electronAPI.getScreenshotPath(filename);
        window.mpvAPI.command(['screenshot-to-file', screenshotPath, 'video']);
        showOSD('SCREENSHOT', 'Saved to Pictures/Perdanga VSP');
    } catch (err) {
        console.error(err);
        showOSD('SCREENSHOT ERROR', 'Failed to capture frame');
    }
};

const updateVolumeUI = () => {
    const vol = parseFloat(volumeSlider.value);
    if (vol === 0) {
        volUpIcon.style.display = 'none';
        volMuteIcon.style.display = 'block';
    } else {
        volUpIcon.style.display = 'block';
        volMuteIcon.style.display = 'none';
    }
};

const updatePlaybackSpeed = (rate) => {
    userPlaybackRate = Math.max(0.25, Math.min(4.0, rate));
    const formatted = userPlaybackRate.toFixed(2).replace(/\.00$/, '.0') + 'x';
    speedLabel.textContent = formatted;
    if (mpvInitialized) {
        window.mpvAPI.setProperty('speed', userPlaybackRate);
    }
    showOSD('SPEED', formatted);
};

const updateNavTogglesUI = () => {
    const hasPlaylist = playlist.length > 1;
    const hasChapters = chaptersEnabled && mediaChapters.length > 0;
    chaptersBtn.style.display = hasChapters ? 'flex' : 'none';
    playlistBtn.style.display = hasPlaylist ? 'flex' : 'none';
    navTogglesDivider.style.display = (hasChapters && hasPlaylist) ? 'block' : 'none';
    if (hasChapters || hasPlaylist) {
        navTogglesBlock.style.display = 'flex';
        navTogglesSeparator.style.display = 'block';
    } else {
        navTogglesBlock.style.display = 'none';
        navTogglesSeparator.style.display = 'none';
    }
};

const updatePlaylistUI = () => {
    if (playlist.length <= 1) playlistPanel.classList.remove('show');
    updateNavTogglesUI();
};

const updateChaptersUI = () => {
    if (chaptersEnabled && mediaChapters.length > 0) {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        prevBtn.style.opacity = '1';
        prevBtn.style.pointerEvents = 'all';
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'all';
    } else {
        chaptersPanel.classList.remove('show');
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
        prevBtn.style.opacity = '0.3';
        prevBtn.style.pointerEvents = 'none';
        nextBtn.style.opacity = '0.3';
        nextBtn.style.pointerEvents = 'none';
    }
    updateNavTogglesUI();
};

const renderPlaylist = () => {
    playlistItemsContainer.innerHTML = '';
    playlist.forEach((p, idx) => {
        const el = document.createElement('div');
        el.className = `panel-item ${idx === playlistIndex ? 'active' : ''}`;
        const textSpan = document.createElement('span');
        textSpan.className = 'panel-item-text';
        textSpan.textContent = p.split('\\').pop().split('/').pop();
        el.appendChild(textSpan);
        el.onclick = () => {
            playlistIndex = idx;
            loadMedia(playlist[playlistIndex]);
        };
        playlistItemsContainer.appendChild(el);
    });
};

const getChapterTitle = (chap, idx) => {
    if (!chap) return `Chapter ${idx + 1}`;
    const title = chap.title || '';
    return title ? title : `Chapter ${idx + 1}`;
};

const renderChapters = () => {
    chaptersItemsContainer.innerHTML = '';
    activeChapterIndex = -1;
    mediaChapters.forEach((chap, idx) => {
        const el = document.createElement('div');
        el.className = 'panel-item';
        const title = getChapterTitle(chap, idx);
        const timeStr = formatTime(parseFloat(chap.time));
        const textSpan = document.createElement('span');
        textSpan.className = 'panel-item-text';
        
        const timeBadge = document.createElement('span');
        timeBadge.style.opacity = '0.5';
        timeBadge.style.marginRight = '8px';
        timeBadge.style.fontVariantNumeric = 'tabular-nums';
        timeBadge.textContent = `[${timeStr}]`;
        
        textSpan.appendChild(timeBadge);
        textSpan.appendChild(document.createTextNode(title));
        el.appendChild(textSpan);
        
        el.onclick = () => {
            window.mpvAPI.seek(parseFloat(chap.time), true, true);
            showOSD("CHAPTER", title);
        };
        chaptersItemsContainer.appendChild(el);
    });
};

const updatePlaylistHighlight = () => {
    const items = playlistItemsContainer.children;
    for (let i = 0; i < items.length; i++) {
        if (i === playlistIndex) {
            items[i].classList.add('active');
            items[i].scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            items[i].classList.remove('active');
        }
    }
};

const checkChapterHighlight = (t) => {
    if (!chaptersEnabled || mediaChapters.length === 0) return;
    let currentIdx = -1;
    for (let i = mediaChapters.length - 1; i >= 0; i--) {
        if (t >= mediaChapters[i].time) {
            currentIdx = i;
            break;
        }
    }
    
    if (currentIdx !== activeChapterIndex) {
        activeChapterIndex = currentIdx;
        const items = chaptersItemsContainer.children;
        for (let i = 0; i < items.length; i++) {
            if (i === activeChapterIndex) {
                items[i].classList.add('active');
                if (chaptersPanel.classList.contains('show')) {
                    items[i].scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } else {
                items[i].classList.remove('active');
            }
        }
    }
};

const togglePlaylist = () => {
    if (!isVideoLoaded || playlist.length <= 1) return;
    playlistPanel.classList.toggle('show');
    chaptersPanel.classList.remove('show'); 
};

const toggleChapters = () => {
    if (!isVideoLoaded || !chaptersEnabled || mediaChapters.length === 0) return;
    chaptersPanel.classList.toggle('show');
    playlistPanel.classList.remove('show');
    if (chaptersPanel.classList.contains('show') && activeChapterIndex >= 0) {
        chaptersItemsContainer.children[activeChapterIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
};

const skipNextChapter = () => {
    if (!chaptersEnabled || mediaChapters.length === 0) return;
    const targetIdx = mediaChapters.findIndex(c => c.time > currentTime + 1);
    if (targetIdx !== -1) {
        const targetChapter = mediaChapters[targetIdx];
        window.mpvAPI.seek(parseFloat(targetChapter.time), true, true);
        showOSD("CHAPTER", getChapterTitle(targetChapter, targetIdx));
    } else {
        playNextFile(true);
    }
};

const skipPrevChapter = () => {
    if (!chaptersEnabled || mediaChapters.length === 0) return;
    let targetIdx = -1;
    for (let i = mediaChapters.length - 1; i >= 0; i--) {
        if (mediaChapters[i].time <= currentTime) {
            if ((currentTime - mediaChapters[i].time) > 3) {
                targetIdx = i; 
            } else if (i > 0) {
                targetIdx = i - 1; 
            }
            break;
        }
    }

    if (targetIdx !== -1) {
        const targetChapter = mediaChapters[targetIdx];
        window.mpvAPI.seek(parseFloat(targetChapter.time), true, true);
        showOSD("CHAPTER", getChapterTitle(targetChapter, targetIdx));
    } else {
        window.mpvAPI.seek(0, true, true);
        showOSD("RESTART", "Restarting File");
    }
};

const playNextFile = (forceSkip = false) => {
    if (!forceSkip && loopMode === 2) {
        window.mpvAPI.seek(0, true, true);
        window.mpvAPI.setProperty('pause', false);
        return;
    }

    if (playlistIndex < playlist.length - 1) {
        playlistIndex++;
        loadMedia(playlist[playlistIndex]);
    } else {
        if (loopMode === 1 && playlist.length > 0) {
            playlistIndex = 0;
            loadMedia(playlist[playlistIndex]);
        } else {
            window.mpvAPI.setProperty('pause', true);
            showOSD("END", "End of Playlist");
        }
    }
};

const playPrevFile = () => {
    if (playlistIndex > 0) {
        playlistIndex--;
        loadMedia(playlist[playlistIndex]);
    } else {
        window.mpvAPI.seek(0, true, true);
        showOSD("RESTART", "Restarting File");
    }
};

const handleFileEnded = () => {
    clearProgress();
    playNextFile(false);
};

const applySettings = (s) => {
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.style.setProperty('--controls-opacity', s.tlOpacity);
    document.documentElement.style.setProperty('--controls-blur', `${s.tlBlur}px`);

    if (s.glow === false) document.body.classList.add('disable-glow');
    else document.body.classList.remove('disable-glow');
    
    chaptersEnabled = s.chapters !== false;

    // «Green Orange» как дефолтная иконка
    const iconPath = s.appIcon || 'ico/GreenOrange.ico';
    mainLogo.src = iconPath;
    audioLogo.src = iconPath;
    window.electronAPI.changeIcon(iconPath);

    if (mpvInitialized) {
        window.mpvAPI.setProperty('sub-scale', parseFloat(s.size));
        window.mpvAPI.setProperty('sub-pos', parseFloat(s.pos));
    }

    if (isVideoLoaded) {
        updateChaptersUI();
        renderMarkers();
    }
};

const loadSettings = () => {
    const saved = JSON.parse(localStorage.getItem('perdangaSettings')) || {};
    const defaults = {
        accent: '#c4c9b6',
        size: '1.0', pos: '100', glow: false, appIcon: 'ico/GreenOrange.ico', chapters: true,
        tlOpacity: '0.75', tlBlur: '24'
    };
    const s = { ...defaults, ...saved };

    appIconSelect.value = s.appIcon;
    accentColorPicker.value = s.accent;
    subSizeSlider.value = s.size;
    subPosSlider.value = s.pos;
    glowToggle.checked = s.glow;
    chaptersToggle.checked = s.chapters;
    timelineOpacitySlider.value = s.tlOpacity;
    timelineBlurSlider.value = s.tlBlur;
    
    applySettings(s);
};

const saveAndApplySettings = () => {
    const s = {
        appIcon: appIconSelect.value,
        accent: accentColorPicker.value,
        size: subSizeSlider.value,
        pos: subPosSlider.value,
        glow: glowToggle.checked,
        chapters: chaptersToggle.checked,
        tlOpacity: timelineOpacitySlider.value,
        tlBlur: timelineBlurSlider.value
    };
    localStorage.setItem('perdangaSettings', JSON.stringify(s));
    applySettings(s);
};

const hideUI = () => {
    playerContainer.classList.add('hide-ui');
    document.body.classList.add('hide-cursor');
};

const showUI = () => {
    playerContainer.classList.remove('hide-ui');
    document.body.classList.remove('hide-cursor');
};

const resetUIHider = (e) => {
    if (e && e.type === 'mousemove') {
        if (e.clientX === lastMouseX && e.clientY === lastMouseY) return;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
    
    showUI();
    clearTimeout(uiTimeout);
    
    if (!isVideoLoaded) return; 

    if (!isPaused) {
        uiTimeout = setTimeout(() => {
            const controlsHovered = document.getElementById('controls').matches(':hover');
            const titleBarHovered = document.getElementById('customTitleBar').matches(':hover');
            const modalOpen = settingsModal.classList.contains('show') ||
                              hotkeysModal.classList.contains('show') ||
                              contextMenu.classList.contains('show') ||
                              playlistPanel.classList.contains('show') ||
                              chaptersPanel.classList.contains('show');

            if (!isScrubbing && 
                !isAccumulatingSeek && 
                !isDraggingVolume &&
                !volumeSlider.matches(':active') &&
                !modalOpen &&
                !controlsHovered &&
                !titleBarHovered) {
                hideUI();
            }
        }, 1200); 
    }
};

const togglePlay = () => {
    if (!isVideoLoaded) return; 
    const newPauseState = !isPaused;
    isVideoPlayingIntent = !newPauseState;
    window.mpvAPI.setProperty('pause', newPauseState);
};

const getDetailedTrackLabel = (track) => {
    const lang = (track.lang && track.lang !== 'und') ? track.lang.toUpperCase() : '';
    const titleStr = track.title ? track.title : `${track.type === 'audio' ? 'Audio' : 'Subtitle'} Track ${track.id}`;
    const mainLabel = lang ? `${lang} - ${titleStr}` : titleStr;
    
    let codec = track.codec ? track.codec.toUpperCase() : '';
    let extra = [];
    if (track.type === 'audio') {
        if (track['demux-channel-count'] === 1) extra.push('Mono');
        else if (track['demux-channel-count'] === 2) extra.push('Stereo');
        else if (track['demux-channel-count'] === 6) extra.push('5.1 Surround');
        else if (track['demux-channel-count'] === 8) extra.push('7.1 Surround');
        else if (track['demux-channel-count']) extra.push(`${track['demux-channel-count']} Ch`);

        if (track['demux-samplerate']) extra.push(`${Math.round(track['demux-samplerate']/1000)}kHz`);
    }
    
    return { mainLabel, subLabel: [codec, ...extra].filter(Boolean).join(' • ') };
};

const updateTrackCounters = () => {
    audioTrackCount.textContent = audioStreams.length > 0 ? `${audioStreams.findIndex(t => t.id === currentAudioTrack) + 1}/${audioStreams.length}` : `0/0`;
    
    if (currentSubTrack === 'off') subTrackCount.textContent = `Off`;
    else if (currentSubTrack === 'external') subTrackCount.textContent = `${subStreams.length + 1}/${subStreams.length + 1} (Ext)`;
    else subTrackCount.textContent = `${subStreams.findIndex(t => t.id === currentSubTrack) + 1}/${subStreams.length}`;
};

const setAudioTrack = (trackId) => {
    if (isAudioMode) return;
    currentAudioTrack = trackId;
    window.mpvAPI.setProperty('aid', trackId);
    updateTrackCounters();
};

const setSubtitle = (trackId) => {
    currentSubTrack = trackId;
    if (trackId === 'off') {
        window.mpvAPI.setProperty('sid', 'no');
    } else if (trackId === 'external') {
        if (externalSubId) window.mpvAPI.setProperty('sid', externalSubId);
    } else {
        window.mpvAPI.setProperty('sid', trackId);
    }
    updateTrackCounters();
};

const cycleAudioTrack = (direction) => {
    if (audioStreams.length === 0 || isAudioMode) return;
    let currentIdx = audioStreams.findIndex(t => t.id === currentAudioTrack);
    let nextIdx = (currentIdx + direction + audioStreams.length) % audioStreams.length;
    const nextTrack = audioStreams[nextIdx];
    setAudioTrack(nextTrack.id);
    const details = getDetailedTrackLabel(nextTrack);
    showOSD("AUDIO TRACK", details.mainLabel, details.subLabel);
};

const cycleSubTrack = (direction) => {
    if (isAudioMode) return;
    let subOptions = [{ id: 'off', main: 'Subtitles Off', sub: '' }];
    subStreams.forEach(s => {
        const details = getDetailedTrackLabel(s);
        subOptions.push({ id: s.id, main: details.mainLabel, sub: details.subLabel });
    });
    if (externalSubId) subOptions.push({ id: 'external', main: 'External File Loaded', sub: 'Custom Subtitle Track' });

    if (subOptions.length <= 1) return showOSD("INFO", "No subtitle tracks available");
    let currentIdx = subOptions.findIndex(o => o.id == currentSubTrack);
    let nextIdx = (currentIdx + direction + subOptions.length) % subOptions.length;
    let nextOpt = subOptions[nextIdx];

    setSubtitle(nextOpt.id);
    showOSD("SUBTITLE", nextOpt.main, nextOpt.sub);
};

const renderMarkers = () => {
    markersContainer.innerHTML = '';
    if (!chaptersEnabled) return;
    if (!mediaDuration || mediaChapters.length === 0) return;
    
    mediaChapters.forEach((chap, idx) => {
        if (chap.time > mediaDuration) return;
        const marker = document.createElement('div');
        marker.className = 'chapter-marker';
        marker.style.left = `${(chap.time / mediaDuration) * 100}%`;
        marker.addEventListener('mousedown', (e) => e.stopPropagation());
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            window.mpvAPI.seek(parseFloat(chap.time), true, true);
            showOSD("CHAPTER", getChapterTitle(chap, idx));
        });
        markersContainer.appendChild(marker);
    });
};

const openSubDialog = (e) => { 
    if (e) e.stopPropagation(); 
    contextMenu.classList.remove('show'); 
    window.electronAPI.openSubDialog(); 
};

const loadMedia = async (filePath) => {
    currentFilePath = filePath;
    playerContainer.classList.add('has-media');
    playerContainer.classList.add('loading-media');
    
    isVideoLoaded = true;
    eofHandled = false;
    currentAudioTrack = null;
    currentSubTrack = 'off';
    externalSubId = null;
    mpvTrackList = [];
    audioStreams = [];
    subStreams = [];
    mediaChapters = [];

    if (playlist.length > 1) {
        updatePlaylistHighlight();
    }

    let progressData = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
    let savedTime = progressData[currentFilePath] || 0;

    npFilename.textContent = currentFilePath.split('\\').pop().split('/').pop();
    npPlaylistInfo.textContent = playlist.length > 1 ? `Track ${playlistIndex + 1} of ${playlist.length}` : "";

    thumbVideoBroken = false;
    thumbVideo.classList.remove('ready');
    let fileUrl = filePath.replace(/\\/g, '/');
    if (!fileUrl.startsWith('file://')) {
        fileUrl = 'file:///' + fileUrl;
    }
    thumbVideo.src = fileUrl;

    window.mpvAPI.setProperty('pause', false);
    isVideoPlayingIntent = true;
    window.mpvAPI.loadFile(filePath);

    if (savedTime > 0) {
        showOSD("RESUMED", formatTime(savedTime));
    }
    
    resetUIHider();
};

const handleMediaFiles = async (files) => {
    if (!files || files.length === 0) return;
    
    const paths = Array.from(files).map(f => {
        return typeof f === 'string' ? f : (f.path || window.electronAPI.getPathForFile(f));
    }).filter(Boolean);

    if (paths.length === 0) return;
    const result = await window.electronAPI.processFiles(paths);

    if (result && result.playlist.length > 0) {
        playlist = result.playlist;
        playlistIndex = result.playlistIndex;
        renderPlaylist();
        loadMedia(playlist[playlistIndex]);
    }

    if (result && result.subPath && isVideoLoaded) {
        window.mpvAPI.command(['sub-add', result.subPath, 'auto']);
        showOSD("EXTERNAL FILE", "Loaded External Subtitle", "Custom Subtitle Track (.vtt / .srt / .ass)");
    }
};

const handleSubFile = (file) => {
    if (!isVideoLoaded) {
        showOSD("INFO", "Load a media file first");
        return;
    }
    
    const safePath = typeof file === 'string' ? file : (file.path || window.electronAPI.getPathForFile(file));
    if (!safePath) return;

    window.electronAPI.processSubFile(safePath).then(authorizedPath => {
        if (authorizedPath) {
            window.mpvAPI.command(['sub-add', authorizedPath, 'auto']);
            showOSD("EXTERNAL FILE", "Loaded External Subtitle", "Custom Subtitle Track (.vtt / .srt / .ass)");
        }
    });
};

// --- 3. MPV EVENT HANDLING ---

window.mpvAPI.onEvent((data) => {
    if (!data) return;

    if (data.type === 'property-change') {
        switch (data.name) {
            case 'time-pos':
                if (!isVideoLoaded) return;
                currentTime = data.value;
                if (!isScrubbing && !isAccumulatingSeek) {
                    if (Math.abs(currentTime - lastProgressBarValue) > 0.05) {
                        progressBar.value = currentTime;
                        lastProgressBarValue = currentTime;
                    }
                    
                    const newTimeStr = formatTime(currentTime);
                    if (newTimeStr !== lastTimeStr) {
                        currentTimeEl.textContent = newTimeStr;
                        lastTimeStr = newTimeStr;
                    }
                    
                    saveProgress(currentTime);
                    checkChapterHighlight(currentTime);
                }
                break;
            case 'duration':
                mediaDuration = data.value || 0;
                progressBar.max = mediaDuration > 0 ? mediaDuration : 100;
                durationEl.textContent = formatTime(mediaDuration);
                renderMarkers();
                break;
            case 'pause':
                isPaused = data.value;
                if (!isVideoLoaded) {
                    playIcon.style.display = 'block'; 
                    pauseIcon.style.display = 'none';
                    if (pulseRing) pulseRing.style.display = 'none';
                    return;
                }
                playIcon.style.display = isPaused ? 'block' : 'none'; 
                pauseIcon.style.display = isPaused ? 'none' : 'block';
                if (isPaused) pulseRing.style.display = 'none';
                else if (isAudioMode) pulseRing.style.display = 'block';
                resetUIHider();
                break;
            case 'track-list':
                try {
                    mpvTrackList = JSON.parse(data.value || '[]');
                } catch (e) {
                    mpvTrackList = [];
                }
                audioStreams = mpvTrackList.filter(t => t.type === 'audio');
                subStreams = mpvTrackList.filter(t => t.type === 'sub');
                
                const videoTracks = mpvTrackList.filter(t => t.type === 'video');
                const wasAudioMode = isAudioMode;
                isAudioMode = videoTracks.length === 0;

                if (wasAudioMode !== isAudioMode) {
                    if (isAudioMode) {
                        audioVisualizer.style.display = 'flex';
                        subSwitchWrap.style.opacity = '0.3';
                        subSwitchWrap.style.pointerEvents = 'none';
                    } else {
                        audioVisualizer.style.display = 'none';
                        subSwitchWrap.style.opacity = '1';
                        subSwitchWrap.style.pointerEvents = 'all';
                    }
                }

                const currentAudio = mpvTrackList.find(t => t.type === 'audio' && t.selected);
                if (currentAudio) currentAudioTrack = currentAudio.id;
                
                const currentSub = mpvTrackList.find(t => t.type === 'sub' && t.selected);
                if (currentSub) {
                    currentSubTrack = currentSub.external ? 'external' : currentSub.id;
                    if (currentSub.external) externalSubId = currentSub.id;
                } else {
                    currentSubTrack = 'off';
                }

                updateTrackCounters();
                break;
            case 'chapter-list':
                try {
                    let parsedChapters = JSON.parse(data.value || '[]');
                    mediaChapters = parsedChapters.map(c => ({
                        title: c.title,
                        time: c.time !== undefined ? c.time : 0
                    }));
                } catch (e) {
                    mediaChapters = [];
                }
                updateChaptersUI();
                renderChapters();
                renderMarkers();
                break;
            case 'volume':
                if (!isDraggingVolume) {
                    volumeSlider.value = data.value / 100;
                    updateVolumeUI();
                }
                break;
            case 'speed':
                if (Math.abs(data.value - userPlaybackRate) > 0.01) {
                    userPlaybackRate = data.value;
                    speedLabel.textContent = userPlaybackRate.toFixed(2).replace(/\.00$/, '.0') + 'x';
                }
                break;
            case 'eof-reached':
                if (data.value && !eofHandled) {
                    eofHandled = true;
                    handleFileEnded();
                }
                break;
            case 'sub-delay':
                subDelay = data.value;
                break;
            case 'estimated-vf-fps':
                currentFps = data.value && data.value > 0 ? data.value : 24;
                break;
        }
        return;
    }

    if (data.type === 'end-file') {
        if (data.reason === 0) { 
            if (!eofHandled) {
                eofHandled = true;
                handleFileEnded();
            }
        } else if (data.reason === 4) {
            playerContainer.classList.remove('loading-media');
            showOSD("PLAYBACK ERROR", "Failed to decode media file");
        }
    }

    if (data.type === 'file-loaded') {
        playerContainer.classList.remove('loading-media');
        emptyState.style.display = 'none';

        let progressData = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
        let savedTime = progressData[currentFilePath] || 0;
        
        const saved = JSON.parse(localStorage.getItem('perdangaSettings')) || {};
        window.mpvAPI.setProperty('sub-scale', parseFloat(saved.size || '1.0'));
        window.mpvAPI.setProperty('sub-pos', parseFloat(saved.pos || '100'));
        window.mpvAPI.setProperty('volume', parseFloat(volumeSlider.value) * 100);
        window.mpvAPI.setProperty('speed', userPlaybackRate);

        if (savedTime > 0) {
            window.mpvAPI.seek(savedTime, true, true);
        }
        
        if (isVideoPlayingIntent) {
            window.mpvAPI.setProperty('pause', false);
        }
    }
});

// --- 4. EVENT LISTENERS ---

playlistBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlaylist(); });
closePlaylistBtn.addEventListener('click', () => playlistPanel.classList.remove('show'));

chaptersBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleChapters(); });
closeChaptersBtn.addEventListener('click', () => chaptersPanel.classList.remove('show'));

loopBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loopMode = (loopMode + 1) % 3;
    if (loopMode === 0) {
        loopBtn.classList.remove('active');
        loopAllIcon.style.display = 'block';
        loopOneIcon.style.display = 'none';
        loopBtn.title = "Toggle Loop (Off)";
        showOSD("LOOP", "Looping Disabled");
    } else if (loopMode === 1) {
        loopBtn.classList.add('active');
        loopAllIcon.style.display = 'block';
        loopOneIcon.style.display = 'none';
        loopBtn.title = "Toggle Loop (Playlist)";
        showOSD("LOOP", "Looping Playlist");
    } else if (loopMode === 2) {
        loopBtn.classList.add('active');
        loopAllIcon.style.display = 'none';
        loopOneIcon.style.display = 'block';
        loopBtn.title = "Toggle Loop (Current)";
        showOSD("LOOP", "Looping Current File");
    }
});

speedWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    let step = e.shiftKey ? 0.25 : 0.05;
    updatePlaybackSpeed(userPlaybackRate + (e.deltaY < 0 ? step : -step));
});

speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    updatePlaybackSpeed(1.0);
});

prevBtn.addEventListener('click', skipPrevChapter);
nextBtn.addEventListener('click', skipNextChapter);

[appIconSelect, accentColorPicker, subSizeSlider, subPosSlider, glowToggle, chaptersToggle, timelineOpacitySlider, timelineBlurSlider].forEach(el => {
    el.addEventListener('input', saveAndApplySettings);
});

settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); settingsModal.classList.add('show'); });
closeSettingsBtn.addEventListener('click', () => { settingsModal.classList.remove('show'); resetUIHider(); });
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) { settingsModal.classList.remove('show'); resetUIHider(); }});

openHotkeysBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsModal.classList.remove('show');
    hotkeysModal.classList.add('show');
});
closeHotkeysBtn.addEventListener('click', () => { hotkeysModal.classList.remove('show'); resetUIHider(); });
hotkeysModal.addEventListener('click', (e) => { if (e.target === hotkeysModal) { hotkeysModal.classList.remove('show'); resetUIHider(); }});

const getTimeFromMouseEvent = (e) => {
    if (!mediaDuration) return 0;
    const rect = progressWrapper.getBoundingClientRect();
    const thumbWidth = 18; 
    let clickX = e.clientX - rect.left - (thumbWidth / 2);
    let trackWidth = rect.width - thumbWidth;
    let pos = 0;
    if (trackWidth > 0) {
        pos = Math.max(0, Math.min(1, clickX / trackWidth));
    }
    return pos * mediaDuration;
};

let scrubThrottle = false;
const performSeek = (time, isFinal = false) => {
    progressBar.value = time;
    lastProgressBarValue = time;
    const newTimeStr = formatTime(time);
    currentTimeEl.textContent = newTimeStr;
    lastTimeStr = newTimeStr;

    if (isFinal) {
        window.mpvAPI.seek(time, true, true);
    } else if (!scrubThrottle) {
        window.mpvAPI.seek(time, true, false);
        scrubThrottle = true;
        setTimeout(() => { scrubThrottle = false; }, 60); 
    }
};

progressWrapper.addEventListener('mousedown', (e) => {
    if (!isVideoLoaded || e.button !== 0) return;
    isScrubbing = true;
    progressWrapper.classList.add('scrubbing');
    window.mpvAPI.setProperty('pause', true);
    const time = getTimeFromMouseEvent(e);
    performSeek(time, false);
});

window.addEventListener('mousemove', (e) => {
    resetUIHider(e);
    if (isScrubbing) {
        const time = getTimeFromMouseEvent(e);
        performSeek(time, false);
    }
});

window.addEventListener('mouseup', () => {
    if (isScrubbing) {
        isScrubbing = false;
        progressWrapper.classList.remove('scrubbing');
        const time = parseFloat(progressBar.value);
        performSeek(time, true);
        if (isVideoPlayingIntent) {
            window.mpvAPI.setProperty('pause', false);
        }
    }
});

let hoverRafPending = false;

progressWrapper.addEventListener('mousemove', (e) => {
    if (!isVideoLoaded || !mediaDuration) return;

    if (hoverRafPending) return;
    hoverRafPending = true;
    const clientX = e.clientX;

    requestAnimationFrame(() => {
        hoverRafPending = false;
        const hoverTime = getTimeFromMouseEvent({ clientX });
        if (isNaN(hoverTime)) return;

        let hoverChapterName = "";
        if (chaptersEnabled && mediaChapters.length > 0) {
            let hoverIdx = -1;
            for (let i = mediaChapters.length - 1; i >= 0; i--) {
                if (mediaChapters[i].time <= hoverTime) {
                    hoverIdx = i;
                    break;
                }
            }
            if (hoverIdx !== -1) {
                const title = getChapterTitle(mediaChapters[hoverIdx], hoverIdx);
                hoverChapterName = `<br><span style="color: var(--accent); font-weight: 700;">${escapeHTML(title)}</span>`;
            }
        }

        let frameNumber = currentFps > 0 ? Math.floor(hoverTime * currentFps) : 0;
        let newHTML = `${formatDetailedTime(hoverTime)} | Frame: ${frameNumber}${hoverChapterName}`;
        if (lastTooltipHTML !== newHTML) {
            thumbText.innerHTML = newHTML;
            lastTooltipHTML = newHTML;
        }

        if (isAudioMode) {
            thumbContainer.style.display = 'none'; 
            timelineTooltip.style.display = 'flex';
            timelineTooltip.style.left = `${clientX}px`;
        } else {
            if (thumbVideoBroken) {
                thumbContainer.style.display = 'none';
            } else {
                thumbContainer.style.display = 'flex';
                thumbVideo.style.display = 'block';
                
                const now = Date.now();
                if (now - lastThumbUpdate > 100) { 
                    if (thumbVideo.readyState >= 1 && !thumbVideo.seeking) {
                        try { thumbVideo.currentTime = hoverTime; } catch(err) {}
                    }
                    lastThumbUpdate = now;
                }
            }
            timelineTooltip.style.display = 'flex';
            timelineTooltip.style.left = `${clientX}px`;
        }
    });
});

progressWrapper.addEventListener('mouseleave', () => timelineTooltip.style.display = 'none');

thumbVideo.addEventListener('error', () => {
    thumbVideoBroken = true;
    thumbContainer.style.display = 'none';
});

thumbVideo.addEventListener('seeked', () => thumbVideo.classList.add('ready'));

window.electronAPI.onLoadPlaylist((result) => {
    if (result && result.playlist.length > 0) {
        playlist = result.playlist;
        playlistIndex = result.playlistIndex;
        renderPlaylist();
        loadMedia(playlist[playlistIndex]);
    }
    if (result && result.subPath && isVideoLoaded) {
        window.mpvAPI.command(['sub-add', result.subPath, 'auto']);
        showOSD("EXTERNAL FILE", "Loaded External Subtitle", "Custom Subtitle Track (.vtt / .srt / .ass)");
    }
});

const openMediaBtn = document.querySelector('label[for="fileInput"]');
if (openMediaBtn) {
    openMediaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.electronAPI.openFileDialog();
    });
}

fileInput.addEventListener('change', function() { 
    if (this.files.length > 0) handleMediaFiles(this.files); 
});
subInput.addEventListener('change', function() { 
    if (this.files[0]) handleSubFile(this.files[0]); 
});

document.addEventListener('dragover', (e) => {
    e.preventDefault();
    playerContainer.classList.add('drag-active');
});

document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
        playerContainer.classList.remove('drag-active');
    }
});

document.addEventListener('drop', (e) => {
    e.preventDefault();
    playerContainer.classList.remove('drag-active');
});

audioSwitchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (audioStreams.length <= 1) return showOSD("INFO", "No alternative audio available");
    cycleAudioTrack(1);
});
subSwitchBtn.addEventListener('click', (e) => { e.stopPropagation(); cycleSubTrack(1); });

let audioWheelTimeout;
audioSwitchWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (audioStreams.length <= 1 || audioWheelTimeout) return;
    audioWheelTimeout = setTimeout(() => { audioWheelTimeout = null; }, 150);
    cycleAudioTrack(e.deltaY > 0 ? 1 : -1);
});

let subWheelTimeout;
subSwitchWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (subWheelTimeout) return;
    subWheelTimeout = setTimeout(() => { subWheelTimeout = null; }, 150);
    cycleSubTrack(e.deltaY > 0 ? 1 : -1);
});

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!currentFilePath || isAudioMode) return; 

    contextAudioList.innerHTML = ''; 
    contextSubList.innerHTML = '';
    
    if (audioStreams.length === 0) {
        contextAudioList.innerHTML = `<div class="ctx-item"><span class="ctx-sub">No Audio Tracks</span></div>`;
    } else {
        audioStreams.forEach((s) => {
            const details = getDetailedTrackLabel(s);
            const item = document.createElement('div');
            item.className = `ctx-item ${currentAudioTrack == s.id ? 'active' : ''}`;
            item.innerHTML = `<span class="ctx-main">${escapeHTML(details.mainLabel)}</span><span class="ctx-sub">${escapeHTML(details.subLabel)}</span>`;
            item.onclick = () => { 
                setAudioTrack(s.id); 
                showOSD("AUDIO", details.mainLabel); 
                contextMenu.classList.remove('show'); 
                resetUIHider();
            };
            contextAudioList.appendChild(item);
        });
    }

    const offItem = document.createElement('div');
    offItem.className = `ctx-item ${currentSubTrack === 'off' ? 'active' : ''}`;
    offItem.innerHTML = `<span class="ctx-main">Disabled</span><span class="ctx-sub">Turn off subtitles</span>`;
    offItem.onclick = () => { 
        setSubtitle('off'); 
        showOSD("SUBTITLE", "Subtitles Off"); 
        contextMenu.classList.remove('show'); 
        resetUIHider(); 
    };
    contextSubList.appendChild(offItem);

    subStreams.forEach((s) => {
        const details = getDetailedTrackLabel(s);
        const item = document.createElement('div');
        let isActive = currentSubTrack == s.id;
        if (s.external && currentSubTrack === 'external') isActive = true;
        item.className = `ctx-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `<span class="ctx-main">${escapeHTML(details.mainLabel)}</span><span class="ctx-sub">${escapeHTML(details.subLabel)}</span>`;
        item.onclick = () => { 
            setSubtitle(s.external ? 'external' : s.id); 
            showOSD("SUBTITLE", details.mainLabel); 
            contextMenu.classList.remove('show'); 
            resetUIHider(); 
        };
        contextSubList.appendChild(item);
    });

    contextMenu.classList.add('show');
    let x = e.pageX, y = e.pageY;
    const rect = contextMenu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 10;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 10;
    contextMenu.style.left = `${x}px`; 
    contextMenu.style.top = `${y}px`;
});

contextMenu.addEventListener('wheel', e => e.stopPropagation());
document.addEventListener('click', (e) => { 
    if (!contextMenu.contains(e.target)) contextMenu.classList.remove('show'); 
    if (playlistPanel.classList.contains('show') && !playlistPanel.contains(e.target) && !playlistBtn.contains(e.target)) playlistPanel.classList.remove('show');
    if (chaptersPanel.classList.contains('show') && !chaptersPanel.contains(e.target) && !chaptersBtn.contains(e.target)) chaptersPanel.classList.remove('show');
    resetUIHider();
});

playBtn.addEventListener('click', togglePlay);

videoClickSurface.addEventListener('click', () => {
    if (isAudioMode) return;
    clearTimeout(surfaceClickTimer);
    surfaceClickTimer = setTimeout(() => {
        togglePlay();
    }, 250);
});

videoClickSurface.addEventListener('dblclick', (e) => {
    e.preventDefault();
    clearTimeout(surfaceClickTimer);
    if (!isAudioMode) {
        window.electronAPI.toggleFullscreen();
    }
});

fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.electronAPI.toggleFullscreen();
});

audioVisualizer.addEventListener('click', () => { if (isAudioMode) togglePlay(); });

loadSubBtn.addEventListener('click', openSubDialog);
ctxLoadSub.addEventListener('click', openSubDialog);

volumeWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    isDraggingVolume = true;
    
    let vol = parseFloat(volumeSlider.value) + (e.deltaY < 0 ? 0.05 : -0.05);
    vol = Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
    volumeSlider.value = vol;
    window.mpvAPI.setProperty('volume', vol * 100);
    updateVolumeUI();
    showOSD("VOLUME", `${Math.round(vol * 100)}%`);
    
    setTimeout(() => { isDraggingVolume = false; }, 100);
});

volumeSlider.addEventListener('mousedown', () => { isDraggingVolume = true; });
volumeSlider.addEventListener('input', () => {
    const vol = parseFloat(volumeSlider.value);
    window.mpvAPI.setProperty('volume', vol * 100);
    updateVolumeUI();
    showOSD("VOLUME", `${Math.round(vol * 100)}%`);
});
window.addEventListener('mouseup', () => { isDraggingVolume = false; });

muteBtn.addEventListener('click', () => {
    const isMuted = parseFloat(volumeSlider.value) === 0;
    const newVol = isMuted ? 1 : 0;
    volumeSlider.value = newVol;
    window.mpvAPI.setProperty('volume', newVol * 100);
    updateVolumeUI();
    showOSD("VOLUME", `${Math.round(newVol * 100)}%`);
});

// --- API EXPORT FOR HOTKEYS MODULE ---
window.PlayerAPI = {
    get isVideoLoaded() { return isVideoLoaded; },
    get isAudioMode() { return isAudioMode; },
    get isVideoPlayingIntent() { return isVideoPlayingIntent; },
    get isPaused() { return isPaused; },
    get chaptersEnabled() { return chaptersEnabled; },
    get currentSubTrack() { return currentSubTrack; },
    get subDelay() { return subDelay; },
    get subSizeSlider() { return subSizeSlider; },
    get subPosSlider() { return subPosSlider; },
    togglePlay,
    showOSD,
    takeScreenshot,
    playNextFile,
    playPrevFile,
    skipNextChapter,
    skipPrevChapter,
    togglePlaylist,
    toggleChapters,
    saveAndApplySettings,
    accumulateSeek,
    setSubDelay: (delay) => {
        subDelay = delay;
        window.mpvAPI.setProperty('sub-delay', delay);
    },
    changePlaybackSpeed: (delta) => updatePlaybackSpeed(userPlaybackRate + delta),
    formatTime,
    resetUIHider
};

// --- 5. INITIALIZATION ---

async function initPlayer() {
    loadSettings();
    mpvInitialized = await window.mpvAPI.initialize();
    window.mpvAPI.setProperty('pause', true);
    window.mpvAPI.setProperty('volume', 100);
    window.mpvAPI.setProperty('speed', 1.0);

    window.chrome.webview.postMessage({ type: 'app-ready' });
}

initPlayer();