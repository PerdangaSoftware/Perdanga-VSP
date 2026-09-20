// ui/renderer.js
(function () {
    'use strict';

    window.App = window.App || {};

    App.Main = {
        initWindowControls() {
            const winMinimize = document.getElementById('win-minimize');
            const winMaximize = document.getElementById('win-maximize');
            const winClose = document.getElementById('win-close');
            const maxIcon = winMaximize.querySelector('.max-icon');
            const restoreIcon = winMaximize.querySelector('.restore-icon');

            winMinimize.addEventListener('click', () => window.electronAPI.windowMinimize());
            winMaximize.addEventListener('click', () => window.electronAPI.windowMaximize());
            winClose.addEventListener('click', () => window.electronAPI.windowClose());

            window.electronAPI.onWindowMaximizeState((isMaximized) => {
                maxIcon.style.display = isMaximized ? 'none' : 'block';
                restoreIcon.style.display = isMaximized ? 'block' : 'none';
                winMaximize.title = isMaximized ? 'Restore' : 'Maximize';
                document.body.classList.toggle('maximized', isMaximized);
            });

            window.electronAPI.onFullscreenState((isFullscreen) => {
                document.body.classList.toggle('fullscreen', isFullscreen);
            });
        },

        togglePlay() {
            const state = App.State;
            if (!state.isVideoLoaded) return;
            const newPauseState = !state.isPaused;
            state.isVideoPlayingIntent = !newPauseState;
            window.mpvAPI.setProperty('pause', newPauseState);
        },

        async loadMedia(filePath, subPath = null) {
            const state = App.State;
            const el = App.Elements;

            state.currentFilePath = filePath;
            el.playerContainer.classList.add('has-media');
            el.playerContainer.classList.add('loading-media');

            state.isVideoLoaded = true;
            state.eofHandled = false;
            state.currentAudioTrack = null;
            state.currentSubTrack = 'off';
            state.externalSubId = null;
            state.mpvTrackList = [];
            state.audioStreams = [];
            state.subStreams = [];
            state.mediaChapters = [];
            state.pendingSubPath = subPath;

            App.Thumbnails.reset();

            if (state.playlist.length > 1) {
                App.Playlist.updateHighlight();
            }

            const progressData = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
            const savedTime = progressData[state.currentFilePath] || 0;

            el.npFilename.textContent = state.currentFilePath.split('\\').pop().split('/').pop();
            el.npPlaylistInfo.textContent = state.playlist.length > 1 ? `Track ${state.playlistIndex + 1} of ${state.playlist.length}` : '';

            window.mpvAPI.setProperty('pause', false);
            state.isVideoPlayingIntent = true;
            window.mpvAPI.loadFile(filePath);

            if (savedTime > 0) {
                App.OSD.show('RESUMED', App.Utils.formatTime(savedTime));
            }
            App.OSD.resetUIHider();
        },

        async handleMediaFiles(files) {
            if (!files || files.length === 0) return;
            const paths = Array.from(files).map(f => {
                return typeof f === 'string' ? f : (f.path || window.electronAPI.getPathForFile(f));
            }).filter(Boolean);

            if (paths.length === 0) return;
            const result = await window.electronAPI.processFiles(paths);

            if (result && result.playlist.length > 0) {
                App.State.playlist = result.playlist;
                App.State.playlistIndex = result.playlistIndex;
                App.Playlist.render();
                App.Main.loadMedia(App.State.playlist[App.State.playlistIndex], result.subPath || null);
            }
        },

        handleSubFile(file) {
            if (!App.State.isVideoLoaded) {
                App.OSD.show('INFO', 'Load a media file first');
                return;
            }
            const safePath = typeof file === 'string' ? file : (file.path || window.electronAPI.getPathForFile(file));
            if (!safePath) return;

            window.electronAPI.processSubFile(safePath).then(authorizedPath => {
                if (authorizedPath) {
                    window.mpvAPI.command(['sub-add', authorizedPath, 'auto']);
                    App.OSD.show('EXTERNAL FILE', 'Loaded External Subtitle', 'Custom Subtitle Track (.vtt / .srt / .ass)');
                }
            });
        },

        bindEvents() {
            const el = App.Elements;
            const state = App.State;

            el.playBtn.addEventListener('click', App.Main.togglePlay);

            el.videoClickSurface.addEventListener('click', () => {
                if (state.isAudioMode) return;
                clearTimeout(state.surfaceClickTimer);
                state.surfaceClickTimer = setTimeout(() => {
                    App.Main.togglePlay();
                }, 220);
            });

            el.videoClickSurface.addEventListener('dblclick', (e) => {
                e.preventDefault();
                clearTimeout(state.surfaceClickTimer);
                if (!state.isAudioMode) {
                    window.electronAPI.toggleFullscreen();
                }
            });

            el.fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.electronAPI.toggleFullscreen();
            });

            el.audioVisualizer.addEventListener('click', () => {
                if (state.isAudioMode) App.Main.togglePlay();
            });

            const openSubAction = (e) => {
                if (e) e.stopPropagation();
                el.contextMenu.classList.remove('show');
                window.electronAPI.openSubDialog();
            };

            el.loadSubBtn.addEventListener('click', openSubAction);
            el.ctxLoadSub.addEventListener('click', openSubAction);

            // Native load-playlist hook
            window.electronAPI.onLoadPlaylist((result) => {
                if (result && result.playlist.length > 0) {
                    state.playlist = result.playlist;
                    state.playlistIndex = result.playlistIndex;
                    App.Playlist.render();
                    App.Main.loadMedia(state.playlist[state.playlistIndex], result.subPath || null);
                } else if (result && result.subPath && state.isVideoLoaded && state.currentFilePath) {
                    window.mpvAPI.command(['sub-add', result.subPath, 'auto']);
                    App.OSD.show('EXTERNAL FILE', 'Loaded External Subtitle', 'Custom Subtitle Track (.vtt / .srt / .ass)');
                }
            });

            const openMediaBtn = document.querySelector('label[for="fileInput"]');
            if (openMediaBtn) {
                openMediaBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.electronAPI.openFileDialog();
                });
            }

            el.fileInput.addEventListener('change', function () {
                if (this.files.length > 0) App.Main.handleMediaFiles(this.files);
            });
            el.subInput.addEventListener('change', function () {
                if (this.files[0]) App.Main.handleSubFile(this.files[0]);
            });

            document.addEventListener('dragover', (e) => {
                e.preventDefault();
                el.playerContainer.classList.add('drag-active');
            });
            document.addEventListener('dragleave', (e) => {
                e.preventDefault();
                if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
                    el.playerContainer.classList.remove('drag-active');
                }
            });
            document.addEventListener('drop', (e) => {
                e.preventDefault();
                el.playerContainer.classList.remove('drag-active');
            });

            // MPV Dispatcher
            window.mpvAPI.onEvent((data) => {
                if (!data) return;

                if (data.type === 'property-change') {
                    switch (data.name) {
                        case 'time-pos':
                            if (!state.isVideoLoaded) return;
                            state.currentTime = data.value;
                            if (!state.isMouseDownOnTimeline && !state.isAccumulatingSeek && Date.now() > state.seekLockoutUntil) {
                                if (Math.abs(state.currentTime - state.lastProgressBarValue) > 0.05) {
                                    el.progressBar.value = state.currentTime;
                                    state.lastProgressBarValue = state.currentTime;
                                    App.Timeline.updateProgressBarFill(state.currentTime);
                                }
                                const newTimeStr = App.Utils.formatTime(state.currentTime);
                                if (newTimeStr !== state.lastTimeStr) {
                                    el.currentTimeEl.textContent = newTimeStr;
                                    state.lastTimeStr = newTimeStr;
                                }
                                App.Utils.saveProgress(state.currentTime);
                                App.Playlist.checkChapterHighlight(state.currentTime);
                            }
                            break;
                        case 'duration':
                            state.mediaDuration = data.value || 0;
                            el.progressBar.max = state.mediaDuration > 0 ? state.mediaDuration : 100;
                            el.durationEl.textContent = App.Utils.formatTime(state.mediaDuration);
                            App.Timeline.updateProgressBarFill(parseFloat(el.progressBar.value));
                            App.Timeline.renderMarkers();
                            break;
                        case 'pause':
                            state.isPaused = data.value;
                            if (!state.isVideoLoaded) {
                                el.playIcon.style.display = 'block';
                                el.pauseIcon.style.display = 'none';
                                if (el.pulseRing) el.pulseRing.style.display = 'none';
                                return;
                            }
                            el.playIcon.style.display = state.isPaused ? 'block' : 'none';
                            el.pauseIcon.style.display = state.isPaused ? 'none' : 'block';
                            if (state.isPaused) el.pulseRing.style.display = 'none';
                            else if (state.isAudioMode) el.pulseRing.style.display = 'block';
                            App.OSD.resetUIHider();
                            break;
                        case 'track-list':
                            try {
                                state.mpvTrackList = JSON.parse(data.value || '[]');
                            } catch (err) {
                                state.mpvTrackList = [];
                            }
                            state.audioStreams = state.mpvTrackList.filter(t => t.type === 'audio');
                            state.subStreams = state.mpvTrackList.filter(t => t.type === 'sub');

                            const videoTracks = state.mpvTrackList.filter(t => t.type === 'video');
                            const wasAudioMode = state.isAudioMode;
                            state.isAudioMode = videoTracks.length === 0;

                            if (wasAudioMode !== state.isAudioMode) {
                                if (state.isAudioMode) {
                                    el.audioVisualizer.style.display = 'flex';
                                    el.subSwitchWrap.style.opacity = '0.3';
                                    el.subSwitchWrap.style.pointerEvents = 'none';
                                } else {
                                    el.audioVisualizer.style.display = 'none';
                                    el.subSwitchWrap.style.opacity = '1';
                                    el.subSwitchWrap.style.pointerEvents = 'all';
                                }
                            }

                            App.Thumbnails.updateTrackSupport(videoTracks);

                            const currentAudio = state.mpvTrackList.find(t => t.type === 'audio' && t.selected);
                            if (currentAudio) state.currentAudioTrack = currentAudio.id;

                            const currentSub = state.mpvTrackList.find(t => t.type === 'sub' && t.selected);
                            if (currentSub) {
                                state.currentSubTrack = currentSub.external ? 'external' : currentSub.id;
                                if (currentSub.external) state.externalSubId = currentSub.id;
                            } else {
                                state.currentSubTrack = 'off';
                            }

                            App.Tracks.updateTrackCounters();
                            break;
                        case 'chapter-list':
                            try {
                                const parsedChapters = JSON.parse(data.value || '[]');
                                state.mediaChapters = parsedChapters.map(c => ({
                                    title: c.title,
                                    time: c.time !== undefined ? c.time : 0
                                }));
                            } catch (err) {
                                state.mediaChapters = [];
                            }
                            App.Playlist.updateChaptersUI();
                            App.Playlist.renderChapters();
                            App.Timeline.renderMarkers();
                            break;
                        case 'volume':
                            if (!state.isDraggingVolume) {
                                el.volumeSlider.value = Math.max(0, Math.min(1, (data.value || 0) / 100));
                                App.Tracks.updateVolumeUI();
                            }
                            break;
                        case 'speed':
                            if (Math.abs(data.value - state.userPlaybackRate) > 0.01) {
                                state.userPlaybackRate = data.value;
                                el.speedLabel.textContent = state.userPlaybackRate.toFixed(2).replace(/\.00$/, '.0') + 'x';
                            }
                            break;
                        case 'eof-reached':
                            if (data.value && !state.eofHandled) {
                                state.eofHandled = true;
                                App.Utils.clearProgress();
                                App.Playlist.playNextFile(false);
                            }
                            break;
                        case 'sub-delay':
                            state.subDelay = data.value;
                            break;
                        case 'container-fps':
                        case 'fps':
                        case 'estimated-vf-fps':
                            if (data.value && data.value > 0) {
                                state.currentFps = data.value;
                            }
                            break;
                    }
                    return;
                }

                if (data.type === 'end-file') {
                    if (data.reason === 0) {
                        if (!state.eofHandled) {
                            state.eofHandled = true;
                            App.Utils.clearProgress();
                            App.Playlist.playNextFile(false);
                        }
                    } else if (data.reason === 4) {
                        el.playerContainer.classList.remove('loading-media');
                        App.OSD.show('PLAYBACK ERROR', 'Failed to decode media file');
                    }
                }

                if (data.type === 'file-loaded') {
                    el.playerContainer.classList.remove('loading-media');
                    el.emptyState.style.display = 'none';

                    const progressData = JSON.parse(localStorage.getItem('perdangaProgress')) || {};
                    const savedTime = progressData[state.currentFilePath] || 0;

                    const saved = JSON.parse(localStorage.getItem('perdangaSettings')) || {};
                    window.mpvAPI.setProperty('sub-scale', parseFloat(saved.size || '1.0'));
                    window.mpvAPI.setProperty('sub-pos', parseFloat(saved.pos || '100'));
                    window.mpvAPI.setProperty('volume', parseFloat(el.volumeSlider.value) * 100);
                    window.mpvAPI.setProperty('speed', state.userPlaybackRate);

                    if (state.pendingSubPath) {
                        window.mpvAPI.command(['sub-add', state.pendingSubPath, 'auto']);
                        App.OSD.show('EXTERNAL FILE', 'Loaded External Subtitle', 'Custom Subtitle Track (.vtt / .srt / .ass)');
                        state.pendingSubPath = null;
                    }

                    if (savedTime > 0) {
                        state.seekLockoutUntil = Date.now() + 300;
                        window.mpvAPI.seek(savedTime, true, true);
                    }

                    if (state.isVideoPlayingIntent) {
                        window.mpvAPI.setProperty('pause', false);
                    }
                }
            });
        },

        exportAPI() {
            const state = App.State;
            const el = App.Elements;

            window.PlayerAPI = {
                get isVideoLoaded() { return state.isVideoLoaded; },
                get isAudioMode() { return state.isAudioMode; },
                get isVideoPlayingIntent() { return state.isVideoPlayingIntent; },
                get isPaused() { return state.isPaused; },
                get chaptersEnabled() { return state.chaptersEnabled; },
                get currentSubTrack() { return state.currentSubTrack; },
                get subDelay() { return state.subDelay; },
                get subSizeSlider() { return el.subSizeSlider; },
                get subPosSlider() { return el.subPosSlider; },
                togglePlay: App.Main.togglePlay,
                showOSD: App.OSD.show,
                takeScreenshot: App.Utils.takeScreenshot,
                playNextFile: App.Playlist.playNextFile,
                playPrevFile: App.Playlist.playPrevFile,
                skipNextChapter: App.Playlist.skipNextChapter,
                skipPrevChapter: App.Playlist.skipPrevChapter,
                togglePlaylist: App.Playlist.togglePlaylist,
                toggleChapters: App.Playlist.toggleChapters,
                saveAndApplySettings: App.Settings.saveAndApply,
                accumulateSeek: App.Timeline.accumulateSeek,
                setSubDelay: (delay) => {
                    state.subDelay = Math.max(-300, Math.min(300, delay));
                    window.mpvAPI.setProperty('sub-delay', state.subDelay);
                },
                changePlaybackSpeed: (delta) => App.Tracks.updatePlaybackSpeed(state.userPlaybackRate + delta),
                formatTime: App.Utils.formatTime,
                resetUIHider: App.OSD.resetUIHider
            };
        }
    };

    // Application bootstrap
    async function init() {
        App.Main.initWindowControls();
        App.Settings.load();
        App.Settings.init();
        App.Timeline.init();
        App.Thumbnails.init();
        App.Tracks.init();
        App.Playlist.init();
        App.Main.bindEvents();
        App.Main.exportAPI();

        App.State.mpvInitialized = await window.mpvAPI.initialize();
        window.mpvAPI.setProperty('pause', true);
        window.mpvAPI.setProperty('volume', 100);
        window.mpvAPI.setProperty('speed', 1.0);

        if (window.chrome && window.chrome.webview) {
            window.chrome.webview.postMessage({ type: 'app-ready' });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();