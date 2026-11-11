#include <windows.h>
#include <windowsx.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <commdlg.h>
#include <dwmapi.h>
#include <filesystem>
#include <fstream>
#include <unordered_map>
#include <string>
#include <vector>
#include <memory>
#include <chrono>
#include <thread>
#include <atomic>
#include <mutex>

#include <AppCore/App.h>
#include <AppCore/Window.h>
#include <AppCore/Platform.h>
#include <Ultralight/platform/Platform.h>
#include <Ultralight/Listener.h>
#include <Ultralight/ConsoleMessage.h>
#include <Ultralight/JS.h>

#include "mpv_player.h"
#include "utils.h"

#pragma comment(lib, "shlwapi.lib")
#pragma comment(lib, "shell32.lib")
#pragma comment(lib, "user32.lib")
#pragma comment(lib, "gdi32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "version.lib")
#pragma comment(lib, "dwmapi.lib")
#pragma comment(lib, "comdlg32.lib")

using namespace ultralight;

static const wchar_t VIDEO_WINDOW_CLASS[] = L"PerdangaVSP_VideoWindow";

static HWND g_hVideoWnd = NULL;
static HWND g_hUiWnd = NULL;
static MpvPlayer g_player;
static RefPtr<App> g_app;
static RefPtr<Window> g_uiWindow;
static RefPtr<Panel> g_panel;
static js::API g_api{ "app" };

static bool g_isFullscreen = false;
static RECT g_normalRect = { 100, 100, 1124, 676 };
static bool g_isAppReady = false;
static std::wstring g_pendingInitialArg;
static HICON g_hIconBig = NULL;
static HICON g_hIconSmall = NULL;

static void PostWebMessage(const std::string& jsonMsg);
static void HandleWebMessage(const std::string& rawJson);

static bool ParseHex4(const std::string& s, size_t idx, uint32_t& out) {
    if (idx + 4 > s.size()) return false;
    out = 0;
    for (size_t k = 0; k < 4; ++k) {
        char ch = s[idx + k];
        uint32_t d = 0;
        if (ch >= '0' && ch <= '9') d = ch - '0';
        else if (ch >= 'a' && ch <= 'f') d = ch - 'a' + 10;
        else if (ch >= 'A' && ch <= 'F') d = ch - 'A' + 10;
        else return false;
        out = (out << 4) | d;
    }
    return true;
}

static void AppendUtf8CodePoint(std::string& out, uint32_t cp) {
    if (cp < 0x80) {
        out += static_cast<char>(cp);
    } else if (cp < 0x800) {
        out += static_cast<char>(0xC0 | (cp >> 6));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        out += static_cast<char>(0xE0 | (cp >> 12));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp <= 0x10FFFF) {
        out += static_cast<char>(0xF0 | (cp >> 18));
        out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    }
}

static std::string DecodeJsonString(const std::string& s, size_t startPos, size_t& endPos) {
    std::string val;
    bool escape = false;
    size_t i = startPos;
    for (; i < s.size(); i++) {
        char c = s[i];
        if (escape) {
            if (c == '"') val += '"';
            else if (c == '\\') val += '\\';
            else if (c == '/') val += '/';
            else if (c == 'b') val += '\b';
            else if (c == 'f') val += '\f';
            else if (c == 'n') val += '\n';
            else if (c == 'r') val += '\r';
            else if (c == 't') val += '\t';
            else if (c == 'u') {
                uint32_t cp = 0;
                if (ParseHex4(s, i + 1, cp)) {
                    i += 4;
                    if (cp >= 0xD800 && cp <= 0xDBFF && i + 6 < s.size() && s[i + 1] == '\\' && s[i + 2] == 'u') {
                        uint32_t low = 0;
                        if (ParseHex4(s, i + 3, low) && low >= 0xDC00 && low <= 0xDFFF) {
                            cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
                            i += 6;
                        }
                    }
                    AppendUtf8CodePoint(val, cp);
                } else {
                    val += 'u';
                }
            } else {
                val += c;
            }
            escape = false;
        } else if (c == '\\') {
            escape = true;
        } else if (c == '"') {
            break;
        } else {
            val += c;
        }
    }
    endPos = i;
    return val;
}

static std::string ExtractJsonStringField(const std::string& json, const std::string& field) {
    std::string search = "\"" + field + "\":";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return "";

    pos += search.length();
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\r' || json[pos] == '\n')) {
        pos++;
    }

    if (pos >= json.size() || json[pos] != '"') return "";
    size_t endPos = 0;
    return DecodeJsonString(json, pos + 1, endPos);
}

static bool FindJsonNumber(const std::string& json, const std::string& key, double& out) {
    std::string pattern = "\"" + key + "\":";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return false;

    pos += pattern.size();
    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) {
        pos++;
    }

    size_t start = pos;
    size_t i = start;
    if (i < json.size() && (json[i] == '-' || json[i] == '+')) i++;
    while (i < json.size() && ((json[i] >= '0' && json[i] <= '9') || json[i] == '.' || json[i] == 'e' || json[i] == 'E' || json[i] == '+' || json[i] == '-')) {
        i++;
    }

    if (i == start) return false;
    try {
        out = std::stod(json.substr(start, i - start));
        return true;
    } catch (...) {
        return false;
    }
}

static std::vector<std::string> ExtractJsonStringArray(const std::string& json, const std::string& field) {
    std::vector<std::string> result;
    std::string search = "\"" + field + "\":";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return result;

    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;

    size_t end = json.find(']', pos);
    if (end == std::string::npos) return result;

    std::string arrContent = json.substr(pos + 1, end - pos - 1);
    size_t i = 0;
    while (i < arrContent.size()) {
        size_t start = arrContent.find('"', i);
        if (start == std::string::npos) break;
        size_t stop = 0;
        std::string val = DecodeJsonString(arrContent, start + 1, stop);
        if (stop >= arrContent.size()) break;
        result.push_back(val);
        i = stop + 1;
    }
    return result;
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
    if (!res.audioPath.empty()) {
        json += ",\"audioPath\":\"" + Utils::EscapeJson(res.audioPath) + "\"";
    } else {
        json += ",\"audioPath\":null";
    }
    json += ",\"isAudioOnlyDrop\":" + std::string(res.isAudioOnlyDrop ? "true" : "false");
    json += "}";
    return json;
}

static void PostWebMessage(const std::string& jsonMsg) {
    if (g_app) {
        g_app->PostTask([jsonMsg]() {
            if (g_panel && g_panel->view()) {
                std::string script = "if (window.__dispatchNativeMessage) { window.__dispatchNativeMessage(" + jsonMsg + "); }";
                g_panel->view()->EvaluateScript(script.c_str());
            }
        });
    }
}

static void DispatchInitialFile(const std::wstring& path) {
    std::wstring clean = Utils::CleanPath(path);
    if (clean.empty()) return;

    auto res = Utils::BuildPlaylistData({ clean });
    if (res.playlist.empty()) return;

    PostWebMessage(BuildLoadPlaylistJson(res));
}

static void SaveCurrentNormalRectIfApplicable() {
    if (!g_isFullscreen && !IsZoomed(g_hVideoWnd) && !IsIconic(g_hVideoWnd)) {
        RECT rc;
        GetWindowRect(g_hVideoWnd, &rc);
        HMONITOR hMon = MonitorFromWindow(g_hVideoWnd, MONITOR_DEFAULTTONEAREST);
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

static void SynchronizeUiWindowPos() {
    if (!g_hVideoWnd || !g_hUiWnd) return;
    RECT rc;
    GetWindowRect(g_hVideoWnd, &rc);
    int w = rc.right - rc.left;
    int h = rc.bottom - rc.top;

    SetWindowPos(g_hUiWnd, HWND_TOP, rc.left, rc.top, w, h,
        SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW);
}

static void ToggleWindowFullscreen() {
    g_isFullscreen = !g_isFullscreen;

    g_player.SetProperty("fullscreen", g_isFullscreen ? "yes" : "no");

    if (g_isFullscreen) {
        SaveCurrentNormalRectIfApplicable();

        HMONITOR hMon = MonitorFromWindow(g_hVideoWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int monW = mi.rcMonitor.right - mi.rcMonitor.left;
        int monH = mi.rcMonitor.bottom - mi.rcMonitor.top;

        SetWindowLongPtr(g_hVideoWnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);
        SetWindowPos(g_hVideoWnd, HWND_TOPMOST,
            mi.rcMonitor.left, mi.rcMonitor.top, monW, monH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        SetForegroundWindow(g_hVideoWnd);
        SynchronizeUiWindowPos();
        if (g_hUiWnd) SetFocus(g_hUiWnd);
    } else {
        SetWindowLongPtr(g_hVideoWnd, GWL_STYLE, WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_VISIBLE);

        if (IsZoomed(g_hVideoWnd)) {
            ShowWindow(g_hVideoWnd, SW_RESTORE);
        }

        int winW = g_normalRect.right - g_normalRect.left;
        int winH = g_normalRect.bottom - g_normalRect.top;
        if (winW < 800 || winH < 450) {
            winW = 1024;
            winH = 576;
        }

        HMONITOR hMon = MonitorFromWindow(g_hVideoWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        int posX = g_normalRect.left;
        int posY = g_normalRect.top;

        if (posX < mi.rcWork.left) posX = mi.rcWork.left;
        if (posY < mi.rcWork.top) posY = mi.rcWork.top;
        if (posX + winW > mi.rcWork.right) posX = mi.rcWork.right - winW;
        if (posY + winH > mi.rcWork.bottom) posY = mi.rcWork.bottom - winH;

        SetWindowPos(g_hVideoWnd, HWND_NOTOPMOST, posX, posY, winW, winH,
            SWP_NOCOPYBITS | SWP_FRAMECHANGED);

        SetForegroundWindow(g_hVideoWnd);
        SynchronizeUiWindowPos();
        if (g_hUiWnd) SetFocus(g_hUiWnd);
    }

    std::string fsJson = "{\"type\":\"fullscreen-state\",\"isFullscreen\":" +
        std::string(g_isFullscreen ? "true" : "false") + "}";
    PostWebMessage(fsJson);
}

static void OpenNativeFileDialog() {
    std::vector<wchar_t> filename(32768, L'\0');
    OPENFILENAMEW ofn = { sizeof(ofn) };
    ofn.hwndOwner = g_hVideoWnd;
    ofn.lpstrFilter = L"Media Files\0*.mp4;*.mkv;*.webm;*.avi;*.mov;*.wmv;*.flv;*.ts;*.m2ts;*.mts;*.vob;*.m4v;*.3gp;*.mpg;*.mpeg;*.mp3;*.wav;*.flac;*.ogg;*.m4a;*.aac;*.opus;*.wma;*.alac;*.ac3;*.eac3;*.dts;*.dtshd;*.truehd;*.thd;*.mka\0All Files\0*.*\0";
    ofn.lpstrFile = filename.data();
    ofn.nMaxFile = static_cast<DWORD>(filename.size());
    ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST;

    if (GetOpenFileNameW(&ofn)) {
        auto res = Utils::BuildPlaylistData({ filename.data() });
        PostWebMessage(BuildLoadPlaylistJson(res));
    }
}

static void OpenNativeSubDialog() {
    std::vector<wchar_t> filename(32768, L'\0');
    OPENFILENAMEW ofn = { sizeof(ofn) };
    ofn.hwndOwner = g_hVideoWnd;
    ofn.lpstrFilter = L"Subtitle Files (*.srt;*.ass;*.ssa;*.vtt)\0*.srt;*.ass;*.ssa;*.vtt\0All Files\0*.*\0";
    ofn.lpstrFile = filename.data();
    ofn.nMaxFile = static_cast<DWORD>(filename.size());
    ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST;

    if (GetOpenFileNameW(&ofn)) {
        std::string pathUtf8 = Utils::Utf16ToUtf8(filename.data());
        std::filesystem::path p(filename.data());
        std::string titleUtf8 = Utils::Utf16ToUtf8(p.stem().wstring());
        g_player.Command({ "sub-add", pathUtf8, "select", titleUtf8 });
        g_player.SetProperty("sub-visibility", "yes");
    }
}

static void OpenNativeAudioDialog() {
    std::vector<wchar_t> filename(32768, L'\0');
    OPENFILENAMEW ofn = { sizeof(ofn) };
    ofn.hwndOwner = g_hVideoWnd;
    ofn.lpstrFilter = L"Audio Files (*.mka;*.mp3;*.wav;*.flac;*.ogg;*.m4a;*.aac;*.opus;*.ac3;*.dts)\0*.mka;*.mp3;*.wav;*.flac;*.ogg;*.m4a;*.aac;*.opus;*.ac3;*.dts;*.dtshd;*.truehd;*.thd;*.wma;*.alac;*.eac3\0All Files\0*.*\0";
    ofn.lpstrFile = filename.data();
    ofn.nMaxFile = static_cast<DWORD>(filename.size());
    ofn.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST;

    if (GetOpenFileNameW(&ofn)) {
        std::string pathUtf8 = Utils::Utf16ToUtf8(filename.data());
        std::filesystem::path p(filename.data());
        std::string titleUtf8 = Utils::Utf16ToUtf8(p.stem().wstring());
        g_player.Command({ "audio-add", pathUtf8, "select", titleUtf8 });
    }
}

static bool g_cursorHidden = false;

static void SetCursorHidden(bool hide) {
    if (hide && !g_cursorHidden) {
        g_cursorHidden = true;
        ShowCursor(FALSE);
        if (g_uiWindow) {
            g_uiWindow->SetCursor(ultralight::kCursor_None);
        }
    } else if (!hide && g_cursorHidden) {
        g_cursorHidden = false;
        ShowCursor(TRUE);
        if (g_uiWindow) {
            g_uiWindow->SetCursor(ultralight::kCursor_Pointer);
        }
    }
}

static COLORREF g_customColors[16] = {
    RGB(196, 201, 182), RGB(0, 245, 212), RGB(0, 180, 216), RGB(157, 78, 221),
    RGB(255, 77, 109), RGB(255, 183, 3), RGB(251, 133, 0), RGB(255, 255, 255),
    RGB(82, 183, 136), RGB(239, 71, 111), RGB(255, 209, 102), RGB(6, 214, 160),
    RGB(17, 138, 178), RGB(7, 59, 76), RGB(214, 136, 106), RGB(20, 20, 25)
};

static std::string OpenNativeColorDialog(const std::string& initialHex) {
    CHOOSECOLORW cc = { sizeof(CHOOSECOLORW) };
    cc.hwndOwner = g_hVideoWnd;
    cc.lpCustColors = g_customColors;
    cc.Flags = CC_FULLOPEN | CC_RGBINIT;

    COLORREF initColor = RGB(196, 201, 182);
    if (!initialHex.empty() && initialHex[0] == '#') {
        try {
            unsigned long hexVal = std::stoul(initialHex.substr(1), nullptr, 16);
            if (initialHex.length() == 7) {
                int r = (hexVal >> 16) & 0xFF;
                int g = (hexVal >> 8) & 0xFF;
                int b = hexVal & 0xFF;
                initColor = RGB(r, g, b);
            }
        } catch (...) {}
    }
    cc.rgbResult = initColor;

    if (ChooseColorW(&cc)) {
        char buf[16];
        snprintf(buf, sizeof(buf), "#%02x%02x%02x",
            GetRValue(cc.rgbResult),
            GetGValue(cc.rgbResult),
            GetBValue(cc.rgbResult));
        return std::string(buf);
    }
    return "";
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

    SendMessageW(g_hVideoWnd, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(hBig));
    SendMessageW(g_hVideoWnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(hSmall));

    if (oldBig) DestroyIcon(oldBig);
    if (oldSmall) DestroyIcon(oldSmall);
}

static void HandleWebMessage(const std::string& rawJson) {
    std::string type = ExtractJsonStringField(rawJson, "type");

    if (type == "app-ready") {
        g_isAppReady = true;
        if (g_uiWindow) {
            g_uiWindow->Show();
        }
        SynchronizeUiWindowPos();
        if (g_app) {
            g_app->RunOnce(0.020);
        }
        ShowWindow(g_hVideoWnd, SW_SHOW);
        SynchronizeUiWindowPos();
        UpdateWindow(g_hVideoWnd);
        if (g_hUiWnd) UpdateWindow(g_hUiWnd);
        SetForegroundWindow(g_hVideoWnd);
        if (g_hUiWnd) SetFocus(g_hUiWnd);
        if (!g_pendingInitialArg.empty()) {
            DispatchInitialFile(g_pendingInitialArg);
            g_pendingInitialArg.clear();
        }
    } else if (type == "window-minimize") {
        ShowWindow(g_hVideoWnd, SW_MINIMIZE);
    } else if (type == "window-maximize") {
        if (IsZoomed(g_hVideoWnd)) {
            ShowWindow(g_hVideoWnd, SW_RESTORE);

            int winW = g_normalRect.right - g_normalRect.left;
            int winH = g_normalRect.bottom - g_normalRect.top;
            if (winW < 800 || winH < 450) {
                winW = 1024;
                winH = 576;
            }

            SetWindowPos(g_hVideoWnd, HWND_NOTOPMOST,
                g_normalRect.left, g_normalRect.top, winW, winH,
                SWP_NOCOPYBITS | SWP_FRAMECHANGED);
        } else {
            SaveCurrentNormalRectIfApplicable();
            ShowWindow(g_hVideoWnd, SW_MAXIMIZE);
        }
        SynchronizeUiWindowPos();
    } else if (type == "window-close") {
        PostMessageW(g_hVideoWnd, WM_CLOSE, 0, 0);
    } else if (type == "window-drag") {
        ReleaseCapture();
        SendMessageW(g_hVideoWnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
    } else if (type == "window-resize") {
        std::string dir = ExtractJsonStringField(rawJson, "dir");
        int hit = HTCLIENT;
        if (dir == "left") hit = HTLEFT;
        else if (dir == "right") hit = HTRIGHT;
        else if (dir == "top") hit = HTTOP;
        else if (dir == "bottom") hit = HTBOTTOM;
        else if (dir == "top-left") hit = HTTOPLEFT;
        else if (dir == "top-right") hit = HTTOPRIGHT;
        else if (dir == "bottom-left") hit = HTBOTTOMLEFT;
        else if (dir == "bottom-right") hit = HTBOTTOMRIGHT;

        if (hit != HTCLIENT) {
            ReleaseCapture();
            SendMessageW(g_hVideoWnd, WM_NCLBUTTONDOWN, hit, 0);
        }
    } else if (type == "window-fullscreen") {
        ToggleWindowFullscreen();
    } else if (type == "open-file-dialog") {
        OpenNativeFileDialog();
    } else if (type == "open-sub-dialog") {
        OpenNativeSubDialog();
    } else if (type == "open-audio-dialog") {
        OpenNativeAudioDialog();
    } else if (type == "mpv-load") {
        std::string path = ExtractJsonStringField(rawJson, "path");
        if (!path.empty()) {
            g_player.LoadFile(path);
        }
    } else if (type == "mpv-seek") {
        double time = 0.0;
        if (FindJsonNumber(rawJson, "time", time)) {
            bool exact = (rawJson.find("\"exact\":false") == std::string::npos);
            bool absolute = (rawJson.find("\"absolute\":true") != std::string::npos);
            g_player.Seek(time, absolute, exact);
        }
    } else if (type == "request-thumbnail") {
        double time = 0.0;
        if (FindJsonNumber(rawJson, "time", time)) {
            bool exact = (rawJson.find("\"exact\":true") != std::string::npos);
            double reqIdNum = 0.0;
            uint64_t reqId = 0;
            if (FindJsonNumber(rawJson, "reqId", reqIdNum)) {
                reqId = static_cast<uint64_t>(reqIdNum);
            }
            g_player.RequestThumbnail(time, exact, reqId);
        }
    } else if (type == "mpv-set-property") {
        std::string name = ExtractJsonStringField(rawJson, "name");
        if (!name.empty()) {
            size_t valPos = rawJson.find("\"value\":");
            if (valPos != std::string::npos) {
                valPos += 8;
                while (valPos < rawJson.size() && (rawJson[valPos] == ' ' || rawJson[valPos] == '\t')) valPos++;

                if (valPos < rawJson.size()) {
                    if (rawJson[valPos] == '"') {
                        std::string sVal = ExtractJsonStringField(rawJson, "value");
                        g_player.SetProperty(name, sVal);
                    } else if (rawJson.compare(valPos, 4, "true") == 0) {
                        g_player.SetPropertyBool(name, true);
                    } else if (rawJson.compare(valPos, 5, "false") == 0) {
                        g_player.SetPropertyBool(name, false);
                    } else {
                        size_t endNum = valPos;
                        while (endNum < rawJson.size() && (
                            (rawJson[endNum] >= '0' && rawJson[endNum] <= '9') ||
                            rawJson[endNum] == '.' || rawJson[endNum] == '-' ||
                            rawJson[endNum] == '+' || rawJson[endNum] == 'e' || rawJson[endNum] == 'E')) {
                            endNum++;
                        }
                        std::string numStr = rawJson.substr(valPos, endNum - valPos);
                        if (name == "aid" || name == "sid" || name == "vid") {
                            g_player.SetProperty(name, numStr);
                        } else {
                            try {
                                double dVal = std::stod(numStr);
                                g_player.SetPropertyDouble(name, dVal);
                            } catch (...) {
                                g_player.SetProperty(name, numStr);
                            }
                        }
                    }
                }
            }
        }
    } else if (type == "set-cursor-hidden") {
        bool hide = rawJson.find("\"hidden\":true") != std::string::npos;
        SetCursorHidden(hide);
    } else if (type == "open-color-dialog") {
        double idVal = 0.0;
        long long id = 0;
        if (FindJsonNumber(rawJson, "id", idVal)) id = static_cast<long long>(idVal);
        std::string currentHex = ExtractJsonStringField(rawJson, "currentColor");
        std::string chosenHex = OpenNativeColorDialog(currentHex);
        std::string resJson = "{\"type\":\"rpc-response\",\"id\":" + std::to_string(id) +
            ",\"result\":\"" + Utils::EscapeJson(chosenHex) + "\"}";
        PostWebMessage(resJson);
    } else if (type == "mpv-command") {
        std::vector<std::string> args = ExtractJsonStringArray(rawJson, "args");
        if (!args.empty()) {
            g_player.Command(args);
        }
    } else if (type == "change-icon") {
        std::string iconRel = ExtractJsonStringField(rawJson, "icon");
        if (!iconRel.empty()) {
            wchar_t exePath[MAX_PATH];
            GetModuleFileNameW(NULL, exePath, MAX_PATH);
            std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
            std::filesystem::path iconPath = exeDir / "icons" / std::filesystem::path(iconRel).filename();
            if (!std::filesystem::exists(iconPath)) {
                iconPath = exeDir / "ui" / iconRel;
            }
            if (std::filesystem::exists(iconPath)) {
                ApplyAppIcons(iconPath);
            }
        }
    } else if (type == "get-screenshot-path") {
        double idVal = 0.0;
        long long id = 0;
        if (FindJsonNumber(rawJson, "id", idVal)) id = static_cast<long long>(idVal);
        std::string filename = ExtractJsonStringField(rawJson, "filename");
        std::string p = Utils::GetScreenshotPath(filename);

        std::string resJson = "{\"type\":\"rpc-response\",\"id\":" + std::to_string(id) +
            ",\"result\":\"" + Utils::EscapeJson(p) + "\"}";
        PostWebMessage(resJson);
    } else if (type == "process-files") {
        double idVal = 0.0;
        long long id = 0;
        if (FindJsonNumber(rawJson, "id", idVal)) id = static_cast<long long>(idVal);
        std::vector<std::string> rawPaths = ExtractJsonStringArray(rawJson, "paths");
        std::vector<std::wstring> wpaths;
        wpaths.reserve(rawPaths.size());
        for (const auto& rp : rawPaths) {
            wpaths.push_back(Utils::Utf8ToUtf16(rp));
        }

        auto playlistRes = Utils::BuildPlaylistData(wpaths);
        PostWebMessage("{\"type\":\"rpc-response\",\"id\":" + std::to_string(id) +
            ",\"result\":" + BuildLoadPlaylistJson(playlistRes) + "}");
    }
}

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
        STGMEDIUM stg;
        if (SUCCEEDED(pDataObj->GetData(&fmt, &stg))) {
            HDROP hDrop = static_cast<HDROP>(GlobalLock(stg.hGlobal));
            if (hDrop) {
                UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, NULL, 0);
                std::vector<std::wstring> paths;
                paths.reserve(count);
                for (UINT i = 0; i < count; ++i) {
                    UINT len = DragQueryFileW(hDrop, i, NULL, 0);
                    if (len > 0) {
                        std::wstring p(len + 1, L'\0');
                        if (DragQueryFileW(hDrop, i, &p[0], len + 1)) {
                            p.resize(len);
                            paths.push_back(p);
                        }
                    }
                }
                GlobalUnlock(stg.hGlobal);
                if (!paths.empty()) {
                    auto res = Utils::BuildPlaylistData(paths);
                    PostWebMessage(BuildLoadPlaylistJson(res));
                }
            }
            ReleaseStgMedium(&stg);
        }
        return S_OK;
    }
};

static FileDropTarget g_dropTarget;

static LRESULT CALLBACK VideoWndProc(HWND hWnd, UINT uMsg, WPARAM wParam, LPARAM lParam) {
    switch (uMsg) {
    case WM_NCCALCSIZE: {
        if (wParam == TRUE) {
            if (g_isFullscreen) return 0;
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
        HMONITOR hMon = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
        MONITORINFO mi = { sizeof(mi) };
        GetMonitorInfoW(hMon, &mi);

        if (g_isFullscreen) {
            mmi->ptMaxSize.x = mi.rcMonitor.right - mi.rcMonitor.left;
            mmi->ptMaxSize.y = mi.rcMonitor.bottom - mi.rcMonitor.top;
            mmi->ptMaxPosition.x = mi.rcMonitor.left;
            mmi->ptMaxPosition.y = mi.rcMonitor.top;
            return 0;
        }

        mmi->ptMaxPosition.x = mi.rcWork.left - mi.rcMonitor.left;
        mmi->ptMaxPosition.y = mi.rcWork.top - mi.rcMonitor.top;
        mmi->ptMaxSize.x = mi.rcWork.right - mi.rcWork.left;
        mmi->ptMaxSize.y = mi.rcWork.bottom - mi.rcWork.top;

        mmi->ptMinTrackSize.x = 800;
        mmi->ptMinTrackSize.y = 450;
        return 0;
    }

    case WM_ERASEBKGND: {
        HDC hdc = reinterpret_cast<HDC>(wParam);
        RECT rc;
        GetClientRect(hWnd, &rc);
        FillRect(hdc, &rc, static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH)));
        return 1;
    }

    case WM_ACTIVATE:
        if (wParam != WA_INACTIVE && g_hUiWnd) {
            SetWindowPos(g_hUiWnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
        break;

    case WM_SETFOCUS:
        if (g_hUiWnd) {
            SetFocus(g_hUiWnd);
        }
        break;

    case WM_KEYDOWN:
        if (wParam == VK_ESCAPE) {
            if (g_isFullscreen) {
                ToggleWindowFullscreen();
            } else {
                PostWebMessage("{\"type\":\"escape-pressed\"}");
            }
            return 0;
        }
        break;

    case WM_EXITSIZEMOVE:
        SaveCurrentNormalRectIfApplicable();
        break;

    case WM_MOVE:
    case WM_SIZE:
        SynchronizeUiWindowPos();
        break;

    case WM_SYSCOMMAND:
        if ((wParam & 0xFFF0) == SC_MINIMIZE) {
            if (g_hUiWnd) ShowWindow(g_hUiWnd, SW_HIDE);
        } else if ((wParam & 0xFFF0) == SC_RESTORE) {
            if (g_hUiWnd) ShowWindow(g_hUiWnd, SW_SHOW);
        }
        break;

    case WM_CLOSE:
        if (g_app) {
            g_app->Quit();
        }
        DestroyWindow(hWnd);
        return 0;

    case WM_DESTROY:
        PostQuitMessage(0);
        return 0;
    }
    return DefWindowProcW(hWnd, uMsg, wParam, lParam);
}

struct PakFileEntry {
    uint32_t offset = 0;
    uint32_t size = 0;
};

class PakFileSystem : public ultralight::FileSystem {
public:
    PakFileSystem(const std::wstring& pakPath, ultralight::FileSystem* fallback)
        : m_fallback(fallback) {
        LoadPak(pakPath);
    }

    bool HasPak() const {
        return !m_entries.empty();
    }

    bool FileExists(const ultralight::String& file_path) override {
        std::string p = Normalize(file_path.utf8().data());
        if (m_entries.count(p)) return true;
        return m_fallback ? m_fallback->FileExists(file_path) : false;
    }

    ultralight::String GetFileMimeType(const ultralight::String& file_path) override {
        std::string p = Normalize(file_path.utf8().data());
        if (m_entries.count(p)) {
            size_t dot = p.find_last_of('.');
            if (dot != std::string::npos) {
                std::string ext = p.substr(dot);
                if (ext == ".html" || ext == ".htm") return "text/html";
                if (ext == ".js") return "application/javascript";
                if (ext == ".css") return "text/css";
                if (ext == ".png") return "image/png";
                if (ext == ".ico") return "image/x-icon";
                if (ext == ".svg") return "image/svg+xml";
                if (ext == ".json") return "application/json";
                if (ext == ".woff" || ext == ".woff2") return "font/woff2";
                if (ext == ".ttf") return "font/ttf";
            }
            return "application/octet-stream";
        }
        if (m_fallback) return m_fallback->GetFileMimeType(file_path);
        return "application/unknown";
    }

    ultralight::String GetFileCharset(const ultralight::String& file_path) override {
        std::string p = Normalize(file_path.utf8().data());
        if (m_entries.count(p)) return "utf-8";
        if (m_fallback) return m_fallback->GetFileCharset(file_path);
        return "utf-8";
    }

    ultralight::RefPtr<ultralight::Buffer> OpenFile(const ultralight::String& file_path) override {
        std::string p = Normalize(file_path.utf8().data());
        auto it = m_entries.find(p);
        if (it != m_entries.end() && it->second.offset + it->second.size <= m_data.size()) {
            return ultralight::Buffer::CreateFromCopy(m_data.data() + it->second.offset, it->second.size);
        }
        if (m_fallback) return m_fallback->OpenFile(file_path);
        return nullptr;
    }

private:
    static std::string Normalize(const std::string& raw) {
        std::string s = raw;
        for (auto& c : s) {
            if (c == '\\') c = '/';
            c = static_cast<char>(tolower(static_cast<unsigned char>(c)));
        }
        while (s.rfind("./", 0) == 0) s = s.substr(2);
        while (s.rfind("/", 0) == 0) s = s.substr(1);
        return s;
    }

    void LoadPak(const std::wstring& pakPath) {
        std::ifstream file(pakPath, std::ios::binary | std::ios::ate);
        if (!file.is_open()) return;

        std::streamsize fileSize = file.tellg();
        if (fileSize < 8) return;
        file.seekg(0, std::ios::beg);

        m_data.resize(static_cast<size_t>(fileSize));
        if (!file.read(reinterpret_cast<char*>(m_data.data()), fileSize)) {
            m_data.clear();
            return;
        }

        const uint8_t* ptr = m_data.data();
        uint32_t magic = *reinterpret_cast<const uint32_t*>(ptr);
        uint32_t count = *reinterpret_cast<const uint32_t*>(ptr + 4);
        if (magic != 0x314B4150 || count == 0 || count > 50000) {
            m_data.clear();
            return;
        }

        size_t cursor = 8;
        for (uint32_t i = 0; i < count; ++i) {
            if (cursor + 2 > m_data.size()) break;
            uint16_t pathLen = *reinterpret_cast<const uint16_t*>(ptr + cursor);
            cursor += 2;
            if (cursor + pathLen + 8 > m_data.size()) break;
            std::string path(reinterpret_cast<const char*>(ptr + cursor), pathLen);
            cursor += pathLen;
            uint32_t offset = *reinterpret_cast<const uint32_t*>(ptr + cursor);
            cursor += 4;
            uint32_t size = *reinterpret_cast<const uint32_t*>(ptr + cursor);
            cursor += 4;

            m_entries[Normalize(path)] = { offset, size };
        }
    }

    std::vector<uint8_t> m_data;
    std::unordered_map<std::string, PakFileEntry> m_entries;
    ultralight::FileSystem* m_fallback = nullptr;
};

static std::unique_ptr<PakFileSystem> g_pakFs;

class PlayerApp : public AppListener, public WindowListener, public ViewListener, public LoadListener {
public:
    PlayerApp() {
        wchar_t exePath[MAX_PATH];
        GetModuleFileNameW(NULL, exePath, MAX_PATH);
        std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
        SetCurrentDirectoryW(exeDir.c_str());

        Platform::instance().set_logger(GetDefaultLogger("./ultralight.log"));

        FileSystem* defaultFs = GetPlatformFileSystem("./");
        std::filesystem::path pakPath = exeDir / "resources" / "ui.pak";
        g_pakFs = std::make_unique<PakFileSystem>(pakPath.wstring(), defaultFs);
        Platform::instance().set_file_system(g_pakFs.get());

        Settings settings;
        settings.app_name = "PerdangaVSP";
        settings.developer_name = "PerdangaSoftware";
        settings.file_system_path = "./";

        Config config;
        config.resource_path_prefix = "resources/";

        g_app = App::Create(settings, config);
        g_app->set_listener(this);

        g_uiWindow = Window::Create(g_app->main_monitor(), 1024, 576, false,
            WindowFlags::Borderless | WindowFlags::Transparent | WindowFlags::Hidden);
        g_uiWindow->set_listener(this);

        g_hUiWnd = static_cast<HWND>(g_uiWindow->native_handle());
        SetWindowLongPtr(g_hUiWnd, GWLP_HWNDPARENT, reinterpret_cast<LONG_PTR>(g_hVideoWnd));
        RegisterDragDrop(g_hUiWnd, &g_dropTarget);

        ViewConfig viewConfig = g_uiWindow->default_view_config();
        viewConfig.is_transparent = true;
        g_panel = g_uiWindow->AddPanel({}, viewConfig);
        if (g_panel && g_panel->view()) {
            g_panel->view()->set_view_listener(this);
            g_panel->view()->set_load_listener(this);
        }

        g_api["version"] = "1.3.0";
        g_api.Bind("postMessage", [](std::string msg) {
            HandleWebMessage(msg);
        }, js::Param("message"));

        if (g_api.AttachTo(g_panel->view().get())) {
            g_panel->view()->LoadURL("file:///ui/index.html");
        }
    }

    virtual void OnDOMReady(ultralight::View* caller, uint64_t frame_id, bool is_main_frame, const String& url) override {
        if (is_main_frame && !g_isAppReady) {
            std::thread([]() {
                std::this_thread::sleep_for(std::chrono::milliseconds(500));
                if (!g_isAppReady && g_app) {
                    g_app->PostTask([]() {
                        if (!g_isAppReady) {
                            g_isAppReady = true;
                            if (g_uiWindow) g_uiWindow->Show();
                            ShowWindow(g_hVideoWnd, SW_SHOW);
                            SynchronizeUiWindowPos();
                            UpdateWindow(g_hVideoWnd);
                            if (g_hUiWnd) UpdateWindow(g_hUiWnd);
                            if (!g_pendingInitialArg.empty()) {
                                DispatchInitialFile(g_pendingInitialArg);
                                g_pendingInitialArg.clear();
                            }
                        }
                    });
                }
            }).detach();
        }
    }

    virtual ~PlayerApp() {}

    virtual void OnClose(Window* window) override {
        if (g_app) g_app->Quit();
    }

    virtual void OnResize(Window* window, double width, double height) override {}

    virtual void OnAddConsoleMessage(ultralight::View* caller, const ultralight::ConsoleMessage& msg) override {
        FILE* f = fopen("ultralight.log", "a");
        if (f) {
            fprintf(f, "[JS Console] %s\n", msg.message().utf8().data());
            fclose(f);
        }
    }

    virtual void OnFailLoading(ultralight::View* caller, uint64_t frame_id, bool is_main_frame,
                               const String& url, const String& description,
                               const String& error_domain, int error_code) override {
        FILE* f = fopen("ultralight.log", "a");
        if (f) {
            fprintf(f, "[Load Error] %s: %s (code %d)\n", url.utf8().data(), description.utf8().data(), error_code);
            fclose(f);
        }
    }

    void Run() {
        if (g_app) g_app->Run();
    }
};

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE, PWSTR pCmdLine, int) {
    wchar_t initialExePath[MAX_PATH];
    GetModuleFileNameW(NULL, initialExePath, MAX_PATH);
    std::filesystem::path initialExeDir = std::filesystem::path(initialExePath).parent_path();
    SetCurrentDirectoryW(initialExeDir.c_str());

    HRESULT hrOle = OleInitialize(NULL);
    if (FAILED(hrOle)) return 1;

    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    int nArgs = 0;
    LPWSTR* szArglist = CommandLineToArgvW(GetCommandLineW(), &nArgs);
    if (szArglist) {
        if (nArgs > 1) {
            g_pendingInitialArg = szArglist[1];
        } else if (pCmdLine && *pCmdLine) {
            g_pendingInitialArg = pCmdLine;
        }
        LocalFree(szArglist);
    }

    wchar_t exePath[MAX_PATH];
    GetModuleFileNameW(NULL, exePath, MAX_PATH);
    std::filesystem::path exeDir = std::filesystem::path(exePath).parent_path();
    std::filesystem::path iconPath = exeDir / "icons" / "GreenOrange.ico";
    if (!std::filesystem::exists(iconPath)) {
        iconPath = exeDir / "ui" / "ico" / "GreenOrange.ico";
    }

    WNDCLASSEXW wc = { sizeof(WNDCLASSEXW) };
    wc.lpfnWndProc = VideoWndProc;
    wc.hInstance = hInstance;
    wc.lpszClassName = VIDEO_WINDOW_CLASS;
    wc.hIcon = LoadIconW(hInstance, MAKEINTRESOURCEW(101));
    wc.hCursor = LoadCursor(NULL, IDC_ARROW);
    wc.hbrBackground = static_cast<HBRUSH>(GetStockObject(BLACK_BRUSH));
    RegisterClassExW(&wc);

    RECT workArea;
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    int winW = 1024;
    int winH = 576;
    int posX = workArea.left + (workArea.right - workArea.left - winW) / 2;
    int posY = workArea.top + (workArea.bottom - workArea.top - winH) / 2;

    g_hVideoWnd = CreateWindowExW(
        0,
        VIDEO_WINDOW_CLASS,
        L"Perdanga VSP",
        WS_POPUP | WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX,
        posX, posY, winW, winH,
        NULL, NULL, hInstance, NULL
    );

    if (!g_hVideoWnd) {
        OleUninitialize();
        return 1;
    }

    ApplyAppIcons(iconPath);

    MARGINS margins = { 0, 0, 0, 1 };
    DwmExtendFrameIntoClientArea(g_hVideoWnd, &margins);

    BOOL disableTransitions = FALSE;
    DwmSetWindowAttribute(g_hVideoWnd, DWMWA_TRANSITIONS_FORCEDISABLED, &disableTransitions, sizeof(disableTransitions));

    RegisterDragDrop(g_hVideoWnd, &g_dropTarget);

    g_player.SetEventCallback([](const std::string& ev) {
        if (ev.find("\"type\":\"thumbnail-ready\"") != std::string::npos) {
            PostWebMessage(ev);
        } else {
            PostWebMessage("{\"type\":\"mpv-event\",\"data\":" + ev + "}");
        }
    });

    g_player.Initialize(g_hVideoWnd);

    PlayerApp app;

    MSG msg = {};
    bool running = true;
    while (running) {
        while (PeekMessageW(&msg, NULL, 0, 0, PM_REMOVE)) {
            if (msg.message == WM_QUIT) {
                running = false;
                break;
            }
            if (msg.message == WM_KEYDOWN && msg.wParam == VK_ESCAPE) {
                HWND fg = GetForegroundWindow();
                if (fg == g_hVideoWnd || fg == g_hUiWnd || IsChild(g_hVideoWnd, fg) || IsChild(g_hUiWnd, fg)) {
                    if (g_isFullscreen) {
                        ToggleWindowFullscreen();
                    } else {
                        PostWebMessage("{\"type\":\"escape-pressed\"}");
                    }
                    continue;
                }
            }
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        if (!running) break;

        if (g_app) {
            if (!g_app->RunOnce(0.010)) {
                running = false;
            }
        } else {
            Sleep(10);
        }
    }

    if (g_hUiWnd) RevokeDragDrop(g_hUiWnd);
    RevokeDragDrop(g_hVideoWnd);
    g_player.Destroy();

    if (g_hIconBig) DestroyIcon(g_hIconBig);
    if (g_hIconSmall) DestroyIcon(g_hIconSmall);

    OleUninitialize();
    return 0;
}
