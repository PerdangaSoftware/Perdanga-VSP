#pragma once
#include <mpv/client.h>
#include <windows.h>
#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <atomic>
#include <mutex>

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
    bool IsPaused() const { return m_isPaused.load(); }

private:
    void EventLoop();
    std::string NodeToJson(const mpv_node* node);

    mpv_handle* m_mpv = nullptr;
    std::thread m_eventThread;
    std::atomic<bool> m_running{ false };
    std::atomic<bool> m_isPaused{ true };
    EventCallback m_eventCallback;
    std::mutex m_cbMutex;

    // Внутренние переменные троттлинга частоты time-pos
    double m_lastReportedTime = -1.0;
    ULONGLONG m_lastTimeReportTick = 0;
};