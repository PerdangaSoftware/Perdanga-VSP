(function () {
    'use strict';

    const RPC_TIMEOUT_MS = 15000;

    let rpcId = 0;
    const rpcResolvers = new Map();

    const eventListeners = {
        'window-maximize-state': [],
        'fullscreen-state': [],
        'load-playlist': [],
        'mpv-event': [],
        'thumbnail-ready': []
    };

    // Native messaging endpoint (null when the page runs outside WebView2)
    const host = (window.chrome && window.chrome.webview) ? window.chrome.webview : null;

    function postToHost(message) {
        if (host) host.postMessage(message);
    }

    if (host) {
        host.addEventListener('message', (e) => {
            const data = e.data;
            if (!data) return;

            if (data.type === 'rpc-response') {
                const resolver = rpcResolvers.get(data.id);
                if (resolver) {
                    rpcResolvers.delete(data.id);
                    resolver(data.result);
                }
            } else if (data.type === 'window-maximize-state') {
                eventListeners['window-maximize-state'].forEach(cb => cb(data.state));
            } else if (data.type === 'fullscreen-state') {
                eventListeners['fullscreen-state'].forEach(cb => cb(data.isFullscreen));
            } else if (data.type === 'load-playlist') {
                eventListeners['load-playlist'].forEach(cb => cb(data));
            } else if (data.type === 'mpv-event') {
                eventListeners['mpv-event'].forEach(cb => cb(data.data));
            } else if (data.type === 'thumbnail-ready') {
                eventListeners['thumbnail-ready'].forEach(cb => cb(data));
            }
        });
    }

    // Request/response wrapper. Resolves to null on timeout (graceful
    // fallback) so awaiting UI code keeps working instead of dead-locking.
    function callRpc(type, payload = {}) {
        return new Promise((resolve) => {
            if (!host) {
                resolve(null);
                return;
            }
            const id = ++rpcId;
            const timer = setTimeout(() => {
                if (rpcResolvers.has(id)) {
                    rpcResolvers.delete(id);
                    console.warn('RPC timed out: ' + type);
                    resolve(null);
                }
            }, RPC_TIMEOUT_MS);
            rpcResolvers.set(id, (result) => {
                clearTimeout(timer);
                resolve(result);
            });
            host.postMessage({ type, id, ...payload });
        });
    }

    window.electronAPI = {
        windowMinimize: () => postToHost({ type: 'window-minimize' }),
        windowMaximize: () => postToHost({ type: 'window-maximize' }),
        windowClose: () => postToHost({ type: 'window-close' }),
        windowDrag: () => postToHost({ type: 'window-drag' }),
        windowResize: (dir) => postToHost({ type: 'window-resize', dir }),
        toggleFullscreen: () => postToHost({ type: 'window-fullscreen' }),
        openFileDialog: () => postToHost({ type: 'open-file-dialog' }),
        openSubDialog: () => postToHost({ type: 'open-sub-dialog' }),
        changeIcon: (icon) => postToHost({ type: 'change-icon', icon }),
        onWindowMaximizeState: (cb) => eventListeners['window-maximize-state'].push(cb),
        onFullscreenState: (cb) => eventListeners['fullscreen-state'].push(cb),
        onLoadPlaylist: (cb) => eventListeners['load-playlist'].push(cb),
        processFiles: (paths) => callRpc('process-files', { paths }),
        // Stub kept for API compatibility: external subtitles are loaded
        // natively by the host (open-sub-dialog / sub-add command).
        processSubFile: (path) => Promise.resolve(path),
        getScreenshotPath: (filename) => callRpc('get-screenshot-path', { filename }),
        // NOTE: File.path does not exist in WebView2 (it is an Electron-only
        // feature). Drag & drop is handled natively by the host via IDropTarget,
        // so this is a display-name fallback only.
        getPathForFile: (file) => file.path || file.name
    };

    window.mpvAPI = {
        initialize: () => Promise.resolve(true),
        loadFile: (path) => postToHost({ type: 'mpv-load', path }),
        command: (args) => postToHost({ type: 'mpv-command', args }),
        seek: (time, absolute, exact = true) => postToHost({ type: 'mpv-seek', time, absolute, exact }),
        requestThumbnail: (time) => postToHost({ type: 'request-thumbnail', time }),
        setProperty: (name, value) => postToHost({ type: 'mpv-set-property', name, value }),
        observeProperty: () => {},
        setRenderSize: () => {},
        requestFrame: () => {},
        onFrameData: () => {},
        onEvent: (cb) => eventListeners['mpv-event'].push(cb),
        onThumbnailReady: (cb) => eventListeners['thumbnail-ready'].push(cb)
    };

    function setupInteractions() {
        const titleBar = document.getElementById('customTitleBar');
        if (titleBar) {
            titleBar.addEventListener('mousedown', (e) => {
                if (!e.target.closest('.title-btn') && e.button === 0) {
                    window.electronAPI.windowDrag();
                }
            });
        }

        document.querySelectorAll('.resize-edge, .resize-corner').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.electronAPI.windowResize(handle.dataset.dir);
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupInteractions);
    } else {
        setupInteractions();
    }
})();