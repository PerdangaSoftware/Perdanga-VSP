#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <windowsx.h>
#include <commdlg.h>
#include <shellapi.h>
#include <shlwapi.h>
#include <shobjidl.h>
#include <ole2.h>
#include <dwmapi.h>
#include <wrl/client.h>
#include <wrl/event.h>
#include <WebView2.h>
#include <WebView2EnvironmentOptions.h>

#include "mpv_player.h"
#include "utils.h"
#include <memory>
#include <vector>
#include <string>
#include <algorithm>
#include <filesystem>
#include <cstdint>
#include <cctype>

#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "comdlg32.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "ole32.lib")

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Callback;

#define WM_MPV_ASYNC_EVENT (WM_USER + 101)

static const wchar_t* WINDOW_CLASS_NAME = L"PerdangaVSP_HostWindow";
static HWND g_hMainWnd = NULL;
static ComPtr<ICoreWebView2Controller> g_webViewController;
static ComPtr<ICoreWebView2> g_webView;
static std::unique_ptr<MpvPlayer> g_mpv;

static bool g_isMaximized = false;
static bool g_isFullscreen = false;
static RECT g_normalRect = { 0, 0, 1024, 576 };
static RECT g_lastViewBounds = { -1, -1, -1, -1 };

static HICON g_hIconBig = NULL;
static HICON g_hIconSmall = NULL;

static std::wstring g_pendingInitialArg;
static bool g_isAppReady = false;

// Track display keep-awake state
static bool g_isDisplayRequired = false;

// ---------------------------------------------------------------------------
// Power Management Helpers (Prevent Screen Sleep During Playback)
// ---------------------------------------------------------------------------

static void UpdateDisplayPowerManagement(bool isPlaying) {
    if (g_isDisplayRequired == isPlaying) return;
    g_isDisplayRequired = isPlaying;

    if (isPlaying) {
        // Prevent display from turning off and system from sleeping while playing
        SetThreadExecutionState(ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED);
    } else {
        // Allow monitor to sleep and system to idle normally when paused or stopped
        SetThreadExecutionState(ES_CONTINUOUS);
    }
}

// ---------------------------------------------------------------------------
// Small manual JSON helpers (allocation-light, never throw).
// ---------------------------------------------------------------------------

static inline size_t SkipWs(const std::string& s, size_t pos) {
    while (pos < s.length() && (s[pos] == ' ' || s[pos] == '\t' || s[pos] == '\r' || s[pos] == '\n')) {
        pos++;
    }
    return pos;
}

static void AppendUtf8(std::string& out, uint32_t cp) {
    if (cp < 0x80) {
        out += static_cast<char>(cp);
    } else if (cp < 0x800) {
        out += static_cast<char>(0xC0 | (cp >> 6));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        out += static_cast<char>(0xE0 | (cp >> 12));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else {
        out += static_cast<char>(0xF0 | (cp >> 18));
        out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    }
}

static bool ParseHex4(const std::string& s, size_t pos, uint32_t& val) {
    if (pos + 4 > s.length()) return false;
    val = 0;
    for (int k = 0; k < 4; ++k) {
        char c = s[pos + k];
        val <<= 4;
        if (c >= '0' && c <= '9') val |= static_cast<uint32_t>(c - '0');
        else if (c >= 'a' && c <= 'f') val |= static_cast<uint32_t>(c - 'a' + 10);
        else if (c >= 'A' && c <= 'F') val |= static_cast<uint32_t>(c - 'A' + 10);
        else return false;
    }
    return true;
}

// Parse a JSON string literal. `start` must point at the opening quote.
// Handles standard escapes including \uXXXX and surrogate pairs.
// On success fills `out` and sets `endPos` right after the closing quote.
static bool ParseJsonString(const std::string& json, size_t start, std::string& out, size_t& endPos) {
    out.clear();
    if (start >= json.length() || json[start] != '"') return false;
    size_t i = start + 1;
    while (i < json.length()) {
        char c = json[i];
        if (c == '"') {
            endPos = i + 1;
            return true;
        }
        if (c != '\\') {
            out += c;
            ++i;
            continue;
        }
        if (i + 1 >= json.length()) return false;
        char esc = json[i + 1];
        switch (esc) {
            case '"':  out += '"';  i += 2; break;
            case '\\': out += '\\'; i += 2; break;
            case '/':  out += '/';  i += 2; break;
            case 'b':  out += '\b'; i += 2; break;
            case 'f':  out += '\f'; i += 2; break;
            case 'n':  out += '\n'; i += 2; break;
            case 'r':  out += '\r'; i += 2; break;
            case 't':  out += '\t'; i += 2; break;
            case 'u': {
                uint32_t cp = 0;
                if (!ParseHex4(json, i + 2, cp)) return false;
                i += 6;
                if (cp >= 0xD800 && cp <= 0xDBFF) {
                    // High surrogate: expect a following low surrogate \uDC00-\uDFFF
                    if (i + 1 < json.length() && json[i] == '\\' && json[i + 1] == 'u') {
                        uint32_t lo = 0;
                        if (ParseHex4(json, i + 2, lo) && lo >= 0xDC00 && lo <= 0xDFFF) {
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (lo - 0xDC00);
                            i += 6;
                        }
                    }
                }
                AppendUtf8(out, cp);
                break;
            }
            default:
                return false;
        }
    }
    return false;
}

// Extract a string field by key ("key":"value") with full escape decoding.
static std::string ExtractJsonStringField(const std::string& json, const std::string& key) {
    const std::string pattern = "\"" + key + "\"";
    size_t keyPos = 0;
    while ((keyPos = json.find(pattern, keyPos)) != std::string::npos) {
        size_t afterKey = SkipWs(json, keyPos + pattern.length());
        if (afterKey < json.length() && json[afterKey] == ':') {
            size_t valStart = SkipWs(json, afterKey + 1);
            std::string res;
            size_t endPos = 0;
            if (valStart < json.length() && ParseJsonString(json, valStart, res, endPos)) {
                return res;
            }
        }
        keyPos += pattern.length();
    }
    return "";
}

// Extract an array of strings by key ("key":["a","b",...]).
static std::vector<std::string> ExtractJsonStringArray(const std::string& json, const std::string& key) {
    std::vector<std::string> result;
    const std::string pattern = "\"" + key + "\"";
    size_t keyPos = json.find(pattern);
    if (keyPos == std::string::npos) return result;

    size_t afterKey = SkipWs(json, keyPos + pattern.length());
    if (afterKey >= json.length() || json[afterKey] != ':') return result;

    size_t i = SkipWs(json, afterKey + 1);
    if (i >= json.length() || json[i] != '[') return result;
    ++i;

    while (i < json.length()) {
        i = SkipWs(json, i);
        if (i >= json.length()) break;
        char c = json[i];
        if (c == ']') break;
        if (c == ',') { ++i; continue; }
        if (c == '"') {
            std::string item;
            size_t endPos = 0;
            if (!ParseJsonString(json, i, item, endPos)) break;
            result.push_back(std::move(item));
            i = endPos;
        } else {
            size_t start = i;
            while (i < json.length() && json[i] != ',' && json[i] != ']') ++i;
            std::string lit = json.substr(start, i - start);
            size_t a = lit.find_first_not_of(" \t\r\n");
            if (a != std::string::npos) {
                size_t b = lit.find_last_not_of(" \t\r\n");
                result.push_back(lit.substr(a, b - a + 1));
            }
        }
    }
    return result;
}

// Safely extract a numeric JSON field ("key":123.45). Never throws.
static bool FindJsonNumber(const std::string& json, const std::string& key, double& out) {
    const std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return false;

    size_t i = SkipWs(json, pos + pattern.length());
    if (i >= json.length() || json[i] != ':') return false;

    i = SkipWs(json, i + 1);
    size_t start = i;
    while (i < json.length() &&
           (std::isdigit(static_cast<unsigned char>(json[i])) ||
            json[i] == '+' || json[i] == '-' || json[i] == '.' ||
            json[i] == 'e' || json[i] == 'E')) {
        ++i;
    }
    if (i == start) return false;

    try {
        out = std::stod(json.substr(start, i - start));
        return true;
    } catch (...) {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

void SendWebMessage(const std::string& jsonMsg) {
    if (g_webView) {
        std::wstring wmsg = Utils::Utf8ToUtf16(jsonMsg);
        g_webView->PostWebMessageAsJson(wmsg.c_str());
    }
}

static std::string BuildLoadPlaylistJson(const Utils::PlaylistResult& res) {
    std::string json = "{\"type\":\"load-playlist\",\"playlist\":[";
    for (size_t i = 0; i < res.playlist.size(); ++i) {
        if (i > 0) json += ",";
        json += "\"" + Utils::EscapeJson(res.playlist[i]) + "\"";
    }
    json += "],\"playlistIndex\":" + std::to_string(res.playlistIndex);
    if (!res.subPath.empty()) {
        json += ",\"subPath\":\"" + Utils::EscapeJson(res.subPath) + "\"";
    } else {
        json += ",\"subPath\":null";
    }
    json += "}";
    return json;
}

void ResizeViews(int width, int height) {
    if (g_webViewController) {
        if (g_lastViewBounds.right == width && g_lastViewBounds.bottom == height) {
            return;
        }
        RECT bounds = { 0, 0, width, height };
        g_webViewController->put_Bounds(bounds);
        g_lastViewBounds = bounds;
    }
}

static void ApplyAppIcons(const std::filesystem::path& iconPath) {
    HICON hBig = static_cast<HICON>(LoadImageW(
        NULL, iconPath.c_str(), IMAGE_ICON, 0, 0, LR_LOADFROMFILE | LR_DEFAULTSIZE));
    if (!hBig) return;

    HICON hSmall = static_cast<HICON>(LoadImageW(
        NULL, iconPath.c_str(), IMAGE_ICON,
        GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_LOADFROMFILE));
    if (!hSmall) {
        DestroyIcon(hBig);
        return;
    }

    HICON oldBig = g_hIconBig;
    HICON oldSmall = g_hIconSmall;
    g_hIconBig = hBig;
    g_hIconSmall = hSmall;

    SendMessageW(g_hMainWnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(hBig));
    SendMessageW(g_hMainWnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(hSmall));

    if (oldBig) DestroyIcon(oldBig);
    if (oldSmall) DestroyIcon(oldSmall);
}

void DispatchInitialFile(const std::wstring& path) {
    std::wstring clean = Utils::CleanPath(path);
    if (clean.empty()) return;

    auto res = Utils::BuildPlaylistData({ clean });
    if (res.playlist.empty()) return;

    SendWebMessage(BuildLoadPlaylistJson(res));
}

// ---------------------------------------------------------------------------
// Drag & drop
// ---------------------------------------------------------------------------

class FileDropTarget : public IDropTarget {
public:
    ULONG STDMETHODCALLTYPE AddRef() override { return 1; }
    ULONG STDMETHODCALLTYPE Release() override { return 1; }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** ppv) override {
        if (riid == IID_IUnknown || riid == IID_IDropTarget) {
            *ppv = this;
            return S_OK;
        }
        *ppv = nullptr;
        return E_NOINTERFACE;
    }

    HRESULT STDMETHODCALLTYPE DragEnter(IDataObject*, DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE DragOver(DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        return S_OK;
    }
    HRESULT STDMETHODCALLTYPE DragLeave() override { return S_OK; }

    HRESULT STDMETHODCALLTYPE Drop(IDataObject* pDataObj, DWORD, POINTL, DWORD* pdwEffect) override {
        *pdwEffect = DROPEFFECT_COPY;
        FORMATETC fmt = { CF_HDROP, NULL, DVASPECT_CONTENT, -1, TYMED_HGLOBAL };
        STGMEDIUM stg = {};
        if (SUCCEEDED(pDataObj->GetData(&fmt, &stg)) && stg.hGlobal) {
            HDROP hDrop = static_cast<HDROP>(GlobalLock(stg.hGlobal));
            if (hDrop) {
                UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, NULL, 0);
                std::vector<std::wstring> paths;
                paths.reserve(count);
                for (UINT i = 0; i < count; ++i) {
                    wchar_t buf[MAX_PATH];
                    if (DragQueryFileW(hDrop, i, buf, MAX_PATH)) {
                        paths.push_back(buf);
                    }
                }
                GlobalUnlock(stg.hGlobal);
                if (!paths.empty()) {
                    auto res = Utils::BuildPlaylistData(paths);
                    SendWebMessage(BuildLoadPlaylistJson(res));
                }
            }
            ReleaseStgMedium(&stg);
        }
        return S_OK;
    }
};

static FileDropTarget g_dropTarget;

void AttachDropTargetToTree(HWND hWnd) {
    RevokeDragDrop(hWnd);
    RegisterDragDrop(hWnd, &g_dropTarget);
    EnumChildWindows(hWnd, [](HWND hChild, LPARAM) -> BOOL {
        RevokeDragDrop(hChild);
        RegisterDragDrop(hChild, &g_dropTarget);
        return TRUE;
    }, 0);
}

// ---------------------------------------------------------------------------
// Window geometry
// ---------------------------------------------------------------------------

void SaveCurrentNormalRectIfApplicable() {
    if (!g_isFullscreen && !IsZoomed(g_hMainWnd) && !IsIconic(g_hMainWnd)) {
        RECT rc;
        GetWindowRect(g_hMainWnd, &rc);
        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int w = rc.right - rc.left;
        int h = rc.bottom - rc.top;
        int workW = mi.rcWork.right - mi.rcWork.left;
        int workH = mi.rcWork.bottom - mi.rcWork.top;

        if (w < workW - 20 || h < workH - 20) {
            if (w >= 800 && h >= 450) {
                g_normalRect = rc;
            }
        }
    }
}

void ToggleWindowFullscreen() {
    g_isFullscreen = !g_isFullscreen;

    if (g_mpv) {
        g_mpv->SetProperty("fullscreen", g_isFullscreen ? "yes" : "no");
    }

    if (g_isFullscreen) {
        SaveCurrentNormalRectIfApplicable();

        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int monW = mi.rcMonitor.right - mi.rcMonitor.left;
        int monH = mi.rcMonitor.bottom - mi.rcMonitor.top;

        SetWindowLongPtr(g_hMainWnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);
        SetWindowPos(g_hMainWnd, HWND_TOPMOST,
            mi.rcMonitor.left, mi.rcMonitor.top, monW, monH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        SetForegroundWindow(g_hMainWnd);
        ResizeViews(monW, monH);
    } else {
        SetWindowLongPtr(g_hMainWnd, GWL_STYLE, WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_VISIBLE);

        if (IsZoomed(g_hMainWnd)) {
            ShowWindow(g_hMainWnd, SW_RESTORE);
        }

        int winW = g_normalRect.right - g_normalRect.left;
        int winH = g_normalRect.bottom - g_normalRect.top;
        if (winW < 800 || winH < 450) {
            winW = 1024;
            winH = 576;
        }

        HMONITOR hMon = MonitorFromWindow(g_hMainWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int posX = g_normalRect.left;
        int posY = g_normalRect.top;

        if (posX < mi.rcWork.left || posX + winW > mi.rcWork.right ||
            posY < mi.rcWork.top || posY + winH > mi.rcWork.bottom) {
            posX = mi.rcWork.left + (mi.rcWork.right - mi.rcWork.left - winW) / 2;
            posY = mi.rcWork.top + (mi.rcWork.bottom - mi.rcWork.top - winH) / 2;
        }

        SetWindowPos(g_hMainWnd, HWND_NOTOPMOST,
            posX, posY, winW, winH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        ResizeViews(winW, winH);
        SetForegroundWindow(g_hMainWnd);

        if (g_isMaximized) {
            g_isMaximized = false;
            SendWebMessage("{\"type\":\"window-maximize-state\",\"state\":false}");
        }
    }

    if (g_mpv && g_mpv->IsPaused()) {
        g_mpv->Command({ "redraw" });
    }

    SendWebMessage("{\"type\":\"fullscreen-state\",\"isFullscreen\":" + std::string(g_isFullscreen ? "true" : "false") + "}");
}

// ---------------------------------------------------------------------------
// Native dialogs
// ---------------------------------------------------------------------------

void OpenNativeFileDialog() {
    wchar_t fileBuf[32768] = { 0 };
    OPENFILENAMEW ofn = { sizeof(OPENFILENAMEW) };
    ofn.hwndOwner = g_hMainWnd;
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = sizeof(fileBuf) / sizeof(wchar_t);
    ofn.lpstrFilter = L"Media Files\0*.mp4;*.mkv;*.webm;*.avi;*.mov;*.mp3;*.wav;*.flac;*.ogg;*.m4a\0All Files (*.*)\0*.*\0";
    ofn.nFilterIndex = 1;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_EXPLORER | OFN_ALLOWMULTISELECT;

    if (GetOpenFileNameW(&ofn)) {
        std::vector<std::wstring> selected;
        wchar_t* p = fileBuf;
        std::wstring first = p;
        p += first.length() + 1;
        if (*p == L'\0') {
            selected.push_back(first);
        } else {
            while (*p != L'\0') {
                selected.push_back(first + L"\\" + std::wstring(p));
                p += wcslen(p) + 1;
            }
        }
        auto res = Utils::BuildPlaylistData(selected);
        SendWebMessage(BuildLoadPlaylistJson(res));
    }
}

void OpenNativeSubDialog() {
    wchar_t fileBuf[MAX_PATH] = { 0 };
    OPENFILENAMEW ofn = { sizeof(OPENFILENAMEW) };
    ofn.hwndOwner = g_hMainWnd;
    ofn.lpstrFile = fileBuf;
    ofn.nMaxFile = MAX_PATH;
    ofn.lpstrFilter = L"Subtitles (*.srt;*.vtt;*.ass)\0*.srt;*.vtt;*.ass\0All Files (*.*)\0*.*\0";
    ofn.nFilterIndex = 1;
    ofn.Flags = OFN_PATHMUSTEXIST | OFN_FILEMUSTEXIST | OFN_EXPLORER;

    if (GetOpenFileNameW(&ofn)) {
        std::string path = Utils::Utf16ToUtf8(fileBuf);
        if (g_mpv) {
            g_mpv->Command({ "sub-add", path, "auto" });
        }
    }
}

// ---------------------------------------------------------------------------
// Web message handling
// ---------------------------------------------------------------------------

void HandleWebMessage(const std::wstring& msg) {
    std::string s = Utils::Utf16ToUtf8(msg);
    std::string type = ExtractJsonStringField(s, "type");

    if (type == "app-ready") {
        g_isAppReady = true;
        if (!g_pendingInitialArg.empty()) {
            DispatchInitialFile(g_pendingInitialArg);
            g_pendingInitialArg.clear();
        }
    } else if (type == "window-minimize") {
        ShowWindow(g_hMainWnd, SW_MINIMIZE);
    } else if (type == "window-maximize") {
        if (IsZoomed(g_hMainWnd)) {
            ShowWindow(g_hMainWnd, SW_RESTORE);

            int winW = g_normalRect.right - g_normalRect.left;
            int winH = g_normalRect.bottom - g_normalRect.top;
            if (winW < 800 || winH < 450) {
                winW = 1024;
                winH = 576;
            }

            SetWindowPos(g_hMainWnd, HWND_NOTOPMOST,
                g_normalRect.left, g_normalRect.top, winW, winH,
                SWP_NOCOPYBITS | SWP_FRAMECHANGED);

            ResizeViews(winW, winH);
        } else {
            SaveCurrentNormalRectIfApplicable();
            ShowWindow(g_hMainWnd, SW_MAXIMIZE);
        }
    } else if (type == "window-close") {
        PostMessageW(g_hMainWnd, WM_CLOSE, 0, 0);
    } else if (type == "window-drag") {
        ReleaseCapture();
        SendMessageW(g_hMainWnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    } else if (type == "window-resize") {
        std::string dir = ExtractJsonStringField(s, "dir");
        int hit = HTCLIENT;
        if (dir == "top") hit = HTTOP;
        else if (dir == "bottom") hit = HTBOTTOM;
        else if (dir == "left") hit = HTLEFT;
        else if (dir == "right") hit = HTRIGHT;
        else if (dir == "top-left") hit = HTTOPLEFT;
        else if (dir == "top-right") hit = HTTOPRIGHT;
        else if (dir == "bottom-left") hit = HTBOTTOMLEFT;
        else if (dir == "bottom-right") hit = HTBOTTOMRIGHT;

        if (hit != HTCLIENT && !IsZoomed(g_hMainWnd) && !g_isFullscreen) {
            ReleaseCapture();
            SendMessageW(g_hMainWnd, WM_NCLBUTTONDOWN, hit, 0);
        }
    } else if (type == "window-fullscreen") {
        ToggleWindowFullscreen();
    } else if (type == "open-file-dialog") {
        OpenNativeFileDialog();
    } else if (type == "open-sub-dialog") {
        OpenNativeSubDialog();
    } else if (type == "mpv-load") {
        std::string path = ExtractJsonStringField(s, "path");
        if (g_mpv && !path.empty()) {
            g_mpv->LoadFile(path);
            std::filesystem::path fp(Utils::Utf8ToUtf16(path));
            std::wstring title = L"Perdanga VSP - " + fp.filename().wstring();
            SetWindowTextW(g_hMainWnd, title.c_str());
        }
    } else if (type == "mpv-seek") {
        double time = 0.0;
        if (g_mpv && FindJsonNumber(s, "time", time)) {
            bool abs = s.find("\"absolute\":true") != std::string::npos;
            bool exact = s.find("\"exact\":false") == std::string::npos;
            g_mpv->Seek(time, abs, exact);
        }
    } else if (type == "request-thumbnail") {
        double time = 0.0;
        if (g_mpv && FindJsonNumber(s, "time", time)) {
            g_mpv->RequestThumbnail(time);
        }
    } else if (type == "mpv-set-property") {
        std::string name = ExtractJsonStringField(s, "name");
        if (g_mpv && !name.empty()) {
            std::string valStr;
            bool valid = false;
            size_t vPos = s.find("\"value\":");
            if (vPos != std::string::npos) {
                size_t valStart = SkipWs(s, vPos + 8);
                if (valStart < s.length()) {
                    if (s[valStart] == '"') {
                        std::string decoded;
                        size_t endPos = 0;
                        if (ParseJsonString(s, valStart, decoded, endPos)) {
                            valStr = std::move(decoded);
                            valid = true;
                        }
                    } else {
                        size_t end = s.find_first_of(",}", valStart);
                        valStr = (end != std::string::npos)
                            ? s.substr(valStart, end - valStart)
                            : s.substr(valStart);
                        size_t last = valStr.find_last_not_of(" \t\r\n");
                        if (last != std::string::npos) {
                            valStr = valStr.substr(0, last + 1);
                        }
                        if (!valStr.empty()) {
                            if (valStr == "true") valStr = "yes";
                            else if (valStr == "false") valStr = "no";
                            valid = true;
                        }
                    }
                }
            }
            if (valid) {
                g_mpv->SetProperty(name, valStr);
            }
        }
    } else if (type == "mpv-command") {
        std::vector<std::string> args = ExtractJsonStringArray(s, "args");
        if (g_mpv) {
            g_mpv->Command(args);
        }
    } else if (type == "change-icon") {
        std::string iconRel = ExtractJsonStringField(s, "icon");
        if (!iconRel.empty()) {
            wchar_t exePath[MAX_PATH];
            if (GetModuleFileNameW(NULL, exePath, MAX_PATH)) {
                std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
                std::filesystem::path full = exeDir / "ui" / Utils::Utf8ToUtf16(iconRel);
                ApplyAppIcons(full);
            }
        }
    } else if (type == "get-screenshot-path") {
        double idVal = 0.0;
        long long id = 0;
        if (FindJsonNumber(s, "id", idVal)) {
            id = static_cast<long long>(idVal);
        }
        std::string filename = ExtractJsonStringField(s, "filename");
        std::string p = Utils::GetScreenshotPath(filename);
        SendWebMessage("{\"type\":\"rpc-response\",\"id\":" + std::to_string(id) +
                       ",\"result\":\"" + Utils::EscapeJson(p) + "\"}");
    } else if (type == "process-files") {
        double idVal = 0.0;
        long long id = 0;
        if (FindJsonNumber(s, "id", idVal)) {
            id = static_cast<long long>(idVal);
        }

        std::vector<std::string> rawPaths = ExtractJsonStringArray(s, "paths");
        std::vector<std::wstring> paths;
        paths.reserve(rawPaths.size());
        for (const auto& rp : rawPaths) {
            paths.push_back(Utils::Utf8ToUtf16(rp));
        }

        auto res = Utils::BuildPlaylistData(paths);

        SendWebMessage("{\"type\":\"rpc-response\",\"id\":" + std::to_string(id) +
                       ",\"result\":" + BuildLoadPlaylistJson(res) + "}");
    }
}

// ---------------------------------------------------------------------------
// Window procedure
// ---------------------------------------------------------------------------

LRESULT CALLBACK WndProc(HWND hWnd, UINT msg, WPARAM wParam, LPARAM lParam) {
    switch (msg) {
        case WM_NCACTIVATE: {
            return TRUE;
        }
        case WM_NCPAINT: {
            return 0;
        }
        case WM_NCCALCSIZE: {
            if (wParam == TRUE) {
                if (g_isFullscreen) {
                    return 0;
                }
                if (IsZoomed(hWnd)) {
                    NCCALCSIZE_PARAMS* p = reinterpret_cast<NCCALCSIZE_PARAMS*>(lParam);
                    HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
                    MONITORINFO mi = { sizeof(mi) };
                    GetMonitorInfoW(hMon, &mi);
                    p->rgrc[0] = mi.rcWork;
                    return 0;
                }
                return 0;
            }
            break;
        }
        case WM_GETMINMAXINFO: {
            LPMINMAXINFO mmi = reinterpret_cast<LPMINMAXINFO>(lParam);
            if (g_isFullscreen) {
                HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
                MONITORINFO mi = { sizeof(mi) };
                GetMonitorInfoW(hMon, &mi);
                mmi->ptMaxSize.x = mi.rcMonitor.right - mi.rcMonitor.left;
                mmi->ptMaxSize.y = mi.rcMonitor.bottom - mi.rcMonitor.top;
                mmi->ptMaxPosition.x = mi.rcMonitor.left;
                mmi->ptMaxPosition.y = mi.rcMonitor.top;
                return 0;
            }

            HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
            MONITORINFO mi = { sizeof(mi) };
            GetMonitorInfoW(hMon, &mi);

            mmi->ptMaxPosition.x = mi.rcWork.left - mi.rcMonitor.left;
            mmi->ptMaxPosition.y = mi.rcWork.top - mi.rcMonitor.top;
            mmi->ptMaxSize.x = mi.rcWork.right - mi.rcWork.left;
            mmi->ptMaxSize.y = mi.rcWork.bottom - mi.rcWork.top;

            mmi->ptMinTrackSize.x = 800;
            mmi->ptMinTrackSize.y = 450;
            return 0;
        }
        case WM_DPICHANGED: {
            const RECT* suggested = reinterpret_cast<const RECT*>(lParam);
            SetWindowPos(hWnd, nullptr,
                suggested->left, suggested->top,
                suggested->right - suggested->left,
                suggested->bottom - suggested->top,
                SWP_NOZORDER | SWP_NOACTIVATE);
            return 0;
        }
        case WM_ERASEBKGND: {
            HDC hdc = reinterpret_cast<HDC>(wParam);
            RECT rc;
            GetClientRect(hWnd, &rc);
            FillRect(hdc, &rc, static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));
            return 1;
        }
        case WM_SIZING: {
            RECT* prc = reinterpret_cast<RECT*>(lParam);
            int w = prc->right - prc->left;
            int h = prc->bottom - prc->top;
            static ULONGLONG lastResize = 0;
            ULONGLONG now = GetTickCount64();
            if (now - lastResize >= 16) {
                lastResize = now;
                ResizeViews(w, h);
            }
            break;
        }
        case WM_EXITSIZEMOVE: {
            SaveCurrentNormalRectIfApplicable();
            break;
        }
        case WM_SIZE: {
            int w = LOWORD(lParam);
            int h = HIWORD(lParam);
            if (w > 0 && h > 0) {
                ResizeViews(w, h);
                if (g_mpv && g_mpv->IsPaused()) {
                    g_mpv->Command({ "redraw" });
                }
            }

            bool maxState = (wParam == SIZE_MAXIMIZED);
            if (maxState != g_isMaximized) {
                g_isMaximized = maxState;
                SendWebMessage("{\"type\":\"window-maximize-state\",\"state\":" + std::string(g_isMaximized ? "true" : "false") + "}");
            }
            return 0;
        }
        case WM_PARENTNOTIFY: {
            if (LOWORD(wParam) == WM_CREATE) {
                AttachDropTargetToTree(hWnd);
            }
            break;
        }
        case WM_COPYDATA: {
            PCOPYDATASTRUCT cds = reinterpret_cast<PCOPYDATASTRUCT>(lParam);
            if (cds && cds->lpData && cds->dwData == 1 && cds->cbData >= sizeof(wchar_t)) {
                const wchar_t* data = static_cast<const wchar_t*>(cds->lpData);
                size_t chars = cds->cbData / sizeof(wchar_t);
                if (data[chars - 1] == L'\0') {
                    std::wstring incoming(data, chars - 1);
                    std::wstring clean = Utils::CleanPath(incoming);
                    if (!clean.empty()) {
                        if (g_isAppReady) {
                            DispatchInitialFile(clean);
                        } else {
                            g_pendingInitialArg = clean;
                        }
                    }
                }
            }
            return TRUE;
        }
        case WM_MPV_ASYNC_EVENT: {
            std::string* pStr = reinterpret_cast<std::string*>(lParam);
            if (pStr) {
                if (pStr->find("\"type\":\"thumbnail-ready\"") != std::string::npos) {
                    SendWebMessage(*pStr);
                } else {
                    // Update display power management based on pause & playback status
                    if (pStr->find("\"name\":\"pause\"") != std::string::npos) {
                        if (pStr->find("\"value\":false") != std::string::npos) {
                            UpdateDisplayPowerManagement(true); // Playing: keep monitor awake
                        } else if (pStr->find("\"value\":true") != std::string::npos) {
                            UpdateDisplayPowerManagement(false); // Paused: allow monitor sleep
                        }
                    } else if (pStr->find("\"type\":\"end-file\"") != std::string::npos) {
                        UpdateDisplayPowerManagement(false); // File ended: allow monitor sleep
                    }

                    SendWebMessage("{\"type\":\"mpv-event\",\"data\":" + *pStr + "}");
                }
                delete pStr;
            }
            return 0;
        }
        case WM_DESTROY: {
            // Restore default OS power-management behavior on exit
            UpdateDisplayPowerManagement(false);

            RevokeDragDrop(hWnd);
            EnumChildWindows(hWnd, [](HWND hChild, LPARAM) -> BOOL {
                RevokeDragDrop(hChild);
                return TRUE;
            }, 0);

            if (g_webViewController) {
                g_webViewController->Close();
                g_webView = nullptr;
                g_webViewController = nullptr;
            }

            if (g_mpv) {
                g_mpv->Destroy();
            }

            MSG queuedMsg;
            while (PeekMessageW(&queuedMsg, hWnd, WM_MPV_ASYNC_EVENT, WM_MPV_ASYNC_EVENT, PM_REMOVE)) {
                std::string* pStr = reinterpret_cast<std::string*>(queuedMsg.lParam);
                delete pStr;
            }

            if (g_hIconBig) { DestroyIcon(g_hIconBig); g_hIconBig = NULL; }
            if (g_hIconSmall) { DestroyIcon(g_hIconSmall); g_hIconSmall = NULL; }

            PostQuitMessage(0);
            return 0;
        }
    }
    return DefWindowProcW(hWnd, msg, wParam, lParam);
}

// ---------------------------------------------------------------------------
// WebView2 bootstrap
// ---------------------------------------------------------------------------

void InitWebView(HWND hWnd) {
    PWSTR localAppData = NULL;
    std::wstring userDataPath;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, 0, NULL, &localAppData))) {
        std::filesystem::path udata = std::filesystem::path(localAppData) / L"Perdanga VSP" / L"WebView2";
        CoTaskMemFree(localAppData);
        std::error_code ec;
        std::filesystem::create_directories(udata, ec);
        userDataPath = udata.wstring();
    }

    LPCWSTR pUserData = userDataPath.empty() ? nullptr : userDataPath.c_str();

    CreateCoreWebView2EnvironmentWithOptions(nullptr, pUserData, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [hWnd](HRESULT hr, ICoreWebView2Environment* env) -> HRESULT {
                if (FAILED(hr) || !env) {
                    MessageBoxW(hWnd,
                        L"Failed to initialize WebView2 runtime.\nPlease ensure the Microsoft Edge WebView2 Runtime is installed.",
                        L"Perdanga VSP - Initialization Error", MB_ICONERROR);
                    return hr;
                }

                env->CreateCoreWebView2Controller(hWnd,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [hWnd](HRESULT hr, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(hr) || !controller) return hr;

                            g_webViewController = controller;
                            g_webViewController->get_CoreWebView2(&g_webView);

                            ComPtr<ICoreWebView2Controller4> controller4;
                            if (SUCCEEDED(controller->QueryInterface(IID_PPV_ARGS(&controller4)))) {
                                controller4->put_AllowExternalDrop(FALSE);
                            }

                            ComPtr<ICoreWebView2Controller2> controller2;
                            if (SUCCEEDED(controller->QueryInterface(IID_PPV_ARGS(&controller2)))) {
                                COREWEBVIEW2_COLOR transparent = { 0, 0, 0, 0 };
                                controller2->put_DefaultBackgroundColor(transparent);
                            }

                            RECT rc;
                            GetClientRect(hWnd, &rc);
                            g_webViewController->put_Bounds(rc);
                            g_lastViewBounds = rc;
                            g_webViewController->put_IsVisible(TRUE);

                            ComPtr<ICoreWebView2Settings> settings;
                            g_webView->get_Settings(&settings);
                            if (settings) {
                                settings->put_AreDefaultScriptDialogsEnabled(TRUE);
                                settings->put_IsWebMessageEnabled(TRUE);
                                settings->put_AreDefaultContextMenusEnabled(FALSE);
                                settings->put_AreDevToolsEnabled(FALSE);
                            }

                            EventRegistrationToken token;
                            g_webView->add_WebMessageReceived(
                                Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                        LPWSTR rawJson = nullptr;
                                        if (SUCCEEDED(args->get_WebMessageAsJson(&rawJson)) && rawJson) {
                                            HandleWebMessage(rawJson);
                                            CoTaskMemFree(rawJson);
                                        }
                                        return S_OK;
                                    }).Get(), &token);

                            EventRegistrationToken navToken;
                            g_webView->add_NavigationCompleted(
                                Callback<ICoreWebView2NavigationCompletedEventHandler>(
                                    [](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs*) -> HRESULT {
                                        ShowWindow(g_hMainWnd, SW_SHOW);
                                        UpdateWindow(g_hMainWnd);
                                        SetForegroundWindow(g_hMainWnd);
                                        return S_OK;
                                    }).Get(), &navToken);

                            wchar_t exePath[MAX_PATH];
                            GetModuleFileNameW(NULL, exePath, MAX_PATH);
                            std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
                            std::filesystem::path htmlPath = exeDir / "ui" / "index.html";

                            wchar_t fileUri[2048];
                            DWORD urlLen = 2048;
                            if (SUCCEEDED(UrlCreateFromPathW(htmlPath.c_str(), fileUri, &urlLen, 0))) {
                                g_webView->Navigate(fileUri);
                            } else {
                                std::wstring raw = L"file:///" + htmlPath.wstring();
                                std::replace(raw.begin(), raw.end(), L'\\', L'/');
                                g_webView->Navigate(raw.c_str());
                            }

                            AttachDropTargetToTree(hWnd);
                            return S_OK;
                        }).Get());
                return S_OK;
            }).Get());
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR pCmdLine, int) {
    HRESULT hrOle = OleInitialize(NULL);
    if (FAILED(hrOle)) return 1;

    SetCurrentProcessExplicitAppUserModelID(L"Perdanga.VSP.Player");
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    HANDLE hMutex = CreateMutexW(NULL, TRUE, L"PerdangaVSP_SingleInstance_AppMutex");
    if (!hMutex) {
        OleUninitialize();
        return 1;
    }

    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        HWND hExisting = FindWindowW(WINDOW_CLASS_NAME, NULL);
        if (hExisting) {
            int nArgs = 0;
            LPWSTR* szArglist = CommandLineToArgvW(GetCommandLineW(), &nArgs);
            std::wstring targetFile;
            if (szArglist) {
                if (nArgs > 1) {
                    targetFile = Utils::CleanPath(szArglist[1]);
                } else if (pCmdLine && *pCmdLine) {
                    targetFile = Utils::CleanPath(pCmdLine);
                }
                LocalFree(szArglist);
            }

            if (!targetFile.empty()) {
                COPYDATASTRUCT cds;
                cds.dwData = 1;
                cds.cbData = static_cast<DWORD>((targetFile.length() + 1) * sizeof(wchar_t));
                cds.lpData = const_cast<wchar_t*>(targetFile.c_str());
                SendMessageW(hExisting, WM_COPYDATA, 0, reinterpret_cast<LPARAM>(&cds));
            }

            if (IsIconic(hExisting)) {
                ShowWindow(hExisting, SW_RESTORE);
            }

            DWORD fgThread = 0;
            HWND hForeground = GetForegroundWindow();
            if (hForeground) {
                fgThread = GetWindowThreadProcessId(hForeground, NULL);
            }
            DWORD curThread = GetCurrentThreadId();
            bool attached = (fgThread && fgThread != curThread)
                ? (AttachThreadInput(curThread, fgThread, TRUE) != FALSE)
                : false;
            SetForegroundWindow(hExisting);
            BringWindowToTop(hExisting);
            if (attached) {
                AttachThreadInput(curThread, fgThread, FALSE);
            }
        }
        CloseHandle(hMutex);
        OleUninitialize();
        return 0;
    }

    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
    std::filesystem::path iconPath = exeDir / L"ui" / L"ico" / L"GreenOrange.ico";

    WNDCLASSEXW wc = { sizeof(WNDCLASSEXW) };
    wc.lpfnWndProc = WndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = WINDOW_CLASS_NAME;
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    RegisterClassExW(&wc);

    RECT workArea;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    int winW = 1024;
    int winH = 576;
    int posX = workArea.left + (workArea.right - workArea.left - winW) / 2;
    int posY = workArea.top + (workArea.bottom - workArea.top - winH) / 2;

    g_normalRect.left = posX;
    g_normalRect.top = posY;
    g_normalRect.right = posX + winW;
    g_normalRect.bottom = posY + winH;

    g_hMainWnd = CreateWindowExW(
        WS_EX_APPWINDOW, WINDOW_CLASS_NAME, L"Perdanga VSP",
        WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX,
        posX, posY, winW, winH,
        NULL, NULL, hInstance, NULL
    );

    ApplyAppIcons(iconPath);

    MARGINS margins = { 0, 0, 0, 1 };
    DwmExtendFrameIntoClientArea(g_hMainWnd, &margins);

    BOOL disableTransitions = FALSE;
    DwmSetWindowAttribute(g_hMainWnd, DWMWA_TRANSITIONS_FORCEDISABLED, &disableTransitions, sizeof(disableTransitions));

    SetWindowTextW(g_hMainWnd, L"Perdanga VSP");

    g_mpv = std::make_unique<MpvPlayer>();
    g_mpv->SetEventCallback([](const std::string& jsonEvent) {
        std::string* pStr = new std::string(jsonEvent);
        if (!PostMessageW(g_hMainWnd, WM_MPV_ASYNC_EVENT, 0, reinterpret_cast<LPARAM>(pStr))) {
            delete pStr;
        }
    });
    g_mpv->Initialize(g_hMainWnd);

    int nArgs = 0;
    LPWSTR* szArglist = CommandLineToArgvW(GetCommandLineW(), &nArgs);
    if (szArglist) {
        if (nArgs > 1) {
            g_pendingInitialArg = Utils::CleanPath(szArglist[1]);
        } else if (pCmdLine && *pCmdLine) {
            g_pendingInitialArg = Utils::CleanPath(pCmdLine);
        }
        LocalFree(szArglist);
    }

    InitWebView(g_hMainWnd);

    MSG msg = {};
    while (GetMessageW(&msg, NULL, 0, 0)) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    if (hMutex) {
        ReleaseMutex(hMutex);
        CloseHandle(hMutex);
    }

    OleUninitialize();
    return static_cast<int>(msg.wParam);
}