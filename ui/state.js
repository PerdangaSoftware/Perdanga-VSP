// ui/state.js
(function () {
    'use strict';

    window.App = window.App || {};

    // Cached DOM elements
    App.Elements = {
        playerContainer: document.getElementById('playerContainer'),
        videoClickSurface: document.getElementById('videoClickSurface'),
        emptyState: document.getElementById('emptyState'),
        audioVisualizer: document.getElementById('audioVisualizer'),
        pulseRing: document.querySelector('.audio-pulse-ring'),
        fileInput: document.getElementById('fileInput'),
        subInput: document.getElementById('subInput'),
        mainLogo: document.getElementById('mainLogo'),
        audioLogo: document.getElementById('audioLogo'),

        // Banners & OSD
        nowPlayingBanner: document.getElementById('nowPlayingBanner'),
        npFilename: document.getElementById('npFilename'),
        npPlaylistInfo: document.getElementById('npPlaylistInfo'),
        osdAlert: document.getElementById('osdAlert'),
        osdTitle: document.getElementById('osdTitle'),
        osdMain: document.getElementById('osdMain'),
        osdSub: document.getElementById('osdSub'),
        seekOverlay: document.getElementById('seekOverlay'),
        seekArrows: document.getElementById('seekArrows'),
        seekText: document.getElementById('seekText'),

        // Panels
        playlistPanel: document.getElementById('playlistPanel'),
        playlistItemsContainer: document.getElementById('playlistItems'),
        closePlaylistBtn: document.getElementById('closePlaylistBtn'),
        playlistBtn: document.getElementById('playlistBtn'),
        chaptersPanel: document.getElementById('chaptersPanel'),
        chaptersItemsContainer: document.getElementById('chaptersItems'),
        closeChaptersBtn: document.getElementById('closeChaptersBtn'),
        chaptersBtn: document.getElementById('chaptersBtn'),
        navTogglesBlock: document.getElementById('navTogglesBlock'),
        navTogglesDivider: document.getElementById('navTogglesDivider'),
        navTogglesSeparator: document.getElementById('navTogglesSeparator'),

        // Playback controls
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        playBtn: document.getElementById('playBtn'),
        playIcon: document.getElementById('playIcon'),
        pauseIcon: document.getElementById('pauseIcon'),
        loopBtn: document.getElementById('loopBtn'),
        loopAllIcon: document.getElementById('loopAllIcon'),
        loopOneIcon: document.getElementById('loopOneIcon'),

        // Timeline
        progressWrapper: document.getElementById('progressWrapper'),
        progressBar: document.getElementById('progressBar'),
        markersContainer: document.getElementById('markersContainer'),
        currentTimeEl: document.getElementById('currentTime'),
        durationEl: document.getElementById('duration'),
        timelineTooltip: document.getElementById('timelineTooltip'),
        thumbContainer: document.getElementById('thumbContainer'),
        thumbVideo: document.getElementById('thumbVideo'),
        thumbImg: document.getElementById('thumbImg'),
        thumbText: document.getElementById('thumbText'),

        // Volume & Speed
        volumeWrap: document.getElementById('volumeWrap'),
        volumeSlider: document.getElementById('volumeSlider'),
        muteBtn: document.getElementById('muteBtn'),
        volUpIcon: document.getElementById('volUpIcon'),
        volMuteIcon: document.getElementById('volMuteIcon'),
        speedWrap: document.getElementById('speedWrap'),
        speedBtn: document.getElementById('speedBtn'),
        speedLabel: document.getElementById('speedLabel'),
        fullscreenBtn: document.getElementById('fullscreenBtn'),

        // Track controls
        audioSwitchBtn: document.getElementById('audioSwitchBtn'),
        subSwitchBtn: document.getElementById('subSwitchBtn'),
        audioSwitchWrap: document.getElementById('audioSwitchWrap'),
        subSwitchWrap: document.getElementById('subSwitchWrap'),
        loadSubBtn: document.getElementById('loadSubBtn'),
        audioTrackCount: document.getElementById('audioTrackCount'),
        subTrackCount: document.getElementById('subTrackCount'),

        // Context Menu
        contextMenu: document.getElementById('contextMenu'),
        contextAudioList: document.getElementById('contextAudioList'),
        contextSubList: document.getElementById('contextSubList'),
        ctxLoadSub: document.getElementById('ctxLoadSub'),

        // Settings Modal
        settingsBtn: document.getElementById('settingsBtn'),
        settingsModal: document.getElementById('settingsModal'),
        closeSettingsBtn: document.getElementById('closeSettingsBtn'),
        appIconSelect: document.getElementById('appIconSelect'),
        accentColorPicker: document.getElementById('accentColorPicker'),
        subSizeSlider: document.getElementById('subSizeSlider'),
        subPosSlider: document.getElementById('subPosSlider'),
        glowToggle: document.getElementById('glowToggle'),
        chaptersToggle: document.getElementById('chaptersToggle'),
        timelineOpacitySlider: document.getElementById('timelineOpacitySlider'),
        timelineBlurSlider: document.getElementById('timelineBlurSlider'),

        // Hotkeys Modal
        openHotkeysBtn: document.getElementById('openHotkeysBtn'),
        hotkeysModal: document.getElementById('hotkeysModal'),
        closeHotkeysBtn: document.getElementById('closeHotkeysBtn')
    };

    // Central state
    App.State = {
        currentFilePath: '',
        isVideoLoaded: false,
        isAudioMode: false,
        isPaused: true,
        chaptersEnabled: true,
        userPlaybackRate: 1.0,
        loopMode: 0, // 0 = Off, 1 = Playlist, 2 = Single File

        playlist: [],
        playlistIndex: 0,
        activeChapterIndex: -1,

        mpvTrackList: [],
        audioStreams: [],
        subStreams: [],
        mediaChapters: [],
        currentAudioTrack: null,
        currentSubTrack: 'off',
        externalSubId: null,
        subDelay: 0,
        currentFps: 24,

        pendingSubPath: null,

        // Timeline and Scrubbing
        isMouseDownOnTimeline: false,
        isDraggingTimeline: false,
        mouseDownClientX: 0,
        mouseDownClientY: 0,
        seekLockoutUntil: 0,
        isDraggingVolume: false,
        isAccumulatingSeek: false,
        seekAccumulator: 0,
        seekAccumulatorTimer: null,
        baseSeekTime: 0,
        lastVisualSeekUpdate: 0,

        smoothSeekTarget: 0,
        smoothSeekCurrent: 0,
        smoothSeekRaf: null,

        currentTime: 0,
        mediaDuration: 0,
        isVideoPlayingIntent: false,
        lastSaveTime: 0,
        lastMouseX: -1,
        lastMouseY: -1,
        lastTooltipHTML: '',

        progressCache: null,
        mpvInitialized: false,
        eofHandled: false,

        lastTimeStr: '',
        lastProgressBarValue: -1,
        surfaceClickTimer: null,
        lastVolume: 1.0,

        // Dual Thumbnail Engine State
        isNativeVideoThumbSupported: false,
        lastThumbVideoSrc: '',
        thumbCache: new Map(),
        THUMB_CACHE_LIMIT: 64,
        lastThumbRequestTime: 0,

        // Geometry Cache
        cachedProgressRect: null
    };
})();