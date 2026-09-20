#pragma once
#include <mpv/client.h>
#include <windows.h>
#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>

class MpvPlayer {
public:
    using EventCallback = std::function<void(const std::string& jsonEvent)>;

    MpvPlayer();
    ~MpvPlayer();

    bool Initialize(HWND videoHwnd);
    void Destroy();

    void LoadFile(const std::string& filePath);
    void Command(const std::vector<std::string>& args);
    void Seek(double time, bool absolute, bool exact = true);
    void SetProperty(const std::string& name, const std::string& value);
    void SetPropertyBool(const std::string& name, bool value);
    void SetPropertyDouble(const std::string& name, double value);
    void ObserveProperty(const std::string& name);

    void SetEventCallback(EventCallback cb);
    mpv_handle* GetHandle() const { return m_mpv; }
    bool IsPaused() const { return m_isPaused.load(std::memory_order_relaxed); }

    // Universal Thumbnail Extraction
    void RequestThumbnail(double time);

private:
    void EventLoop();
    void ThumbnailLoop();
    std::string NodeToJson(const mpv_node* node);
    void ApplyHighFidelityRenderProfiles();

    // Primary Player
    mpv_handle* m_mpv = nullptr;
    std::thread m_eventThread;
    std::atomic<bool> m_running{ false };
    std::atomic<bool> m_isPaused{ true };
    EventCallback m_eventCallback;
    std::mutex m_cbMutex;

    double m_lastReportedTime = -1.0;
    ULONGLONG m_lastTimeReportTick = 0;

    // Background Thumbnail Worker
    mpv_handle* m_thumbMpv = nullptr;
    HWND m_thumbHwnd = NULL;
    std::thread m_thumbThread;
    std::mutex m_thumbMutex;
    std::condition_variable m_thumbCv;
    std::string m_currentThumbFilePath;
    std::string m_tempThumbPath;
    double m_pendingThumbTime = -1.0;
    bool m_hasPendingThumbRequest = false;
};