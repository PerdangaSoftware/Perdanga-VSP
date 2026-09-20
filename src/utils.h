// utils.h — shared helpers for the Perdanga VSP host application.
#pragma once

#include <windows.h>
#include <shlwapi.h>
#include <shlobj.h>
#include <cstdio>
#include <string>
#include <vector>
#include <filesystem>
#include <algorithm>
#include <sstream>

#pragma comment(lib, "shlwapi.lib")

namespace Utils {

inline std::wstring CleanPath(std::wstring p) {
    while (!p.empty() && (p.front() == L' ' || p.front() == L'\t' || p.front() == L'\"' || p.front() == L'\'')) {
        p.erase(0, 1);
    }
    while (!p.empty() && (p.back() == L' ' || p.back() == L'\t' || p.back() == L'\"' || p.back() == L'\'')) {
        p.pop_back();
    }
    return p;
}

inline std::string Utf16ToUtf8(const std::wstring& wstr) {
    if (wstr.empty()) return std::string();
    int size_needed = WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), NULL, 0, NULL, NULL);
    std::string strTo(size_needed, 0);
    WideCharToMultiByte(CP_UTF8, 0, &wstr[0], (int)wstr.size(), &strTo[0], size_needed, NULL, NULL);
    return strTo;
}

inline std::wstring Utf8ToUtf16(const std::string& str) {
    if (str.empty()) return std::wstring();
    int size_needed = MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), NULL, 0);
    std::wstring wstrTo(size_needed, 0);
    MultiByteToWideChar(CP_UTF8, 0, &str[0], (int)str.size(), &wstrTo[0], size_needed);
    return wstrTo;
}

// Escape a string for embedding into a JSON string literal.
// FIX: \uXXXX escapes MUST be padded to exactly 4 hex digits. The previous
// version emitted e.g. "\u1" for control char 0x01, which is invalid JSON —
// PostWebMessageAsJson then silently drops the whole message.
inline std::string EscapeJson(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    char buf[8];
    for (unsigned char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    std::snprintf(buf, sizeof(buf), "\\u%04x", static_cast<int>(c));
                    out += buf;
                } else {
                    out += static_cast<char>(c);
                }
        }
    }
    return out;
}

inline bool IsMediaExtension(const std::wstring& ext) {
    static const std::vector<std::wstring> exts = {
        L".mp4", L".mkv", L".webm", L".avi", L".mov", L".wmv", L".flv",
        L".ts", L".m2ts", L".mts", L".vob", L".m4v", L".3gp", L".mpg", L".mpeg",
        L".mp3", L".wav", L".flac", L".ogg", L".m4a", L".aac", L".opus", L".wma", L".alac", L".ac3", L".dts"
    };
    for (const auto& e : exts) {
        if (_wcsicmp(ext.c_str(), e.c_str()) == 0) return true;
    }
    return false;
}

inline bool IsSubExtension(const std::wstring& ext) {
    static const std::vector<std::wstring> exts = { L".srt", L".vtt", L".ass", L".ssa" };
    for (const auto& e : exts) {
        if (_wcsicmp(ext.c_str(), e.c_str()) == 0) return true;
    }
    return false;
}

inline void NaturalSort(std::vector<std::wstring>& files) {
    std::sort(files.begin(), files.end(), [](const std::wstring& a, const std::wstring& b) {
        return StrCmpLogicalW(a.c_str(), b.c_str()) < 0;
    });
}

struct PlaylistResult {
    std::vector<std::string> playlist;
    int playlistIndex = 0;
    std::string subPath;
};

inline PlaylistResult BuildPlaylistData(const std::vector<std::wstring>& inputPaths) {
    PlaylistResult result;
    std::vector<std::wstring> mediaFiles;
    std::vector<std::wstring> subFiles;

    for (auto rawPath : inputPaths) {
        std::wstring pStr = CleanPath(rawPath);
        if (pStr.empty()) continue;

        std::error_code ec;
        std::filesystem::path p(pStr);
        if (std::filesystem::is_directory(p, ec)) {
            std::vector<std::wstring> dirFiles;
            for (auto it = std::filesystem::recursive_directory_iterator(p, std::filesystem::directory_options::skip_permission_denied, ec);
                 it != std::filesystem::recursive_directory_iterator(); ++it) {
                if (it->is_regular_file(ec)) {
                    std::wstring ext = it->path().extension().wstring();
                    if (IsMediaExtension(ext)) {
                        dirFiles.push_back(it->path().wstring());
                    }
                }
            }
            NaturalSort(dirFiles);
            mediaFiles.insert(mediaFiles.end(), dirFiles.begin(), dirFiles.end());
        } else if (std::filesystem::is_regular_file(p, ec)) {
            std::wstring ext = p.extension().wstring();
            if (IsSubExtension(ext)) {
                subFiles.push_back(p.wstring());
            } else {
                // All files passed directly are added to the playlist
                mediaFiles.push_back(p.wstring());
            }
        }
    }

    std::vector<std::wstring> finalPlaylist;
    int targetIdx = 0;

    if (mediaFiles.size() == 1) {
        // Single file: build the playlist from all media siblings in the folder
        std::filesystem::path target(mediaFiles[0]);
        std::filesystem::path parentDir = target.parent_path();
        std::vector<std::wstring> siblingFiles;
        std::error_code ec;

        for (const auto& entry : std::filesystem::directory_iterator(parentDir, ec)) {
            if (entry.is_regular_file(ec) && IsMediaExtension(entry.path().extension().wstring())) {
                siblingFiles.push_back(entry.path().wstring());
            }
        }
        NaturalSort(siblingFiles);

        for (size_t i = 0; i < siblingFiles.size(); ++i) {
            if (_wcsicmp(siblingFiles[i].c_str(), target.wstring().c_str()) == 0) {
                targetIdx = (int)i;
                break;
            }
        }
        finalPlaylist = siblingFiles.empty() ? mediaFiles : siblingFiles;
    } else {
        finalPlaylist = mediaFiles;
    }

    for (const auto& f : finalPlaylist) {
        result.playlist.push_back(Utf16ToUtf8(f));
    }
    result.playlistIndex = targetIdx;

    if (!subFiles.empty()) {
        result.subPath = Utf16ToUtf8(subFiles[0]);
    }
    return result;
}

inline std::string GetScreenshotPath(const std::string& filename) {
    PWSTR picturesPath = NULL;
    if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_Pictures, 0, NULL, &picturesPath))) {
        std::filesystem::path dir = std::filesystem::path(picturesPath) / "Perdanga VSP";
        CoTaskMemFree(picturesPath);
        std::error_code ec;
        std::filesystem::create_directories(dir, ec);
        return Utf16ToUtf8((dir / Utf8ToUtf16(filename)).wstring());
    }
    return filename;
}

} // namespace Utils