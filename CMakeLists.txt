cmake_minimum_required(VERSION 3.20)
project(PerdangaVSP VERSION 1.3.0 LANGUAGES CXX RC)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_compile_definitions(UNICODE _UNICODE)

set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /Os /Oi /GL /Gy /Gw /EHsc /DNDEBUG /fp:fast")
set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} /LTCG /OPT:REF /OPT:ICF /SUBSYSTEM:WINDOWS")

if(NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
    message(FATAL_ERROR "PerdangaVSP supports x64 builds only.")
endif()

set(SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/mpv_player.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/mpv_player.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/utils.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/resource.rc"
)

link_directories(
    "${CMAKE_CURRENT_SOURCE_DIR}/ultralight/lib"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/lib"
)

add_executable(PerdangaVSP WIN32 ${SOURCES})

target_include_directories(PerdangaVSP PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/ultralight/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/include"
)

target_link_libraries(PerdangaVSP
    AppCore
    Ultralight
    UltralightCore
    WebCore
    mpv
    shlwapi
    user32
    gdi32
    shell32
    ole32
    oleaut32
    advapi32
    version
    dwmapi
    comdlg32
)

add_custom_command(TARGET PerdangaVSP POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ultralight/bin"
        "$<TARGET_FILE_DIR:PerdangaVSP>"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ultralight/resources"
        "$<TARGET_FILE_DIR:PerdangaVSP>/resources"
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/ultralight/resources"
        "$<TARGET_FILE_DIR:PerdangaVSP>"
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        "${CMAKE_CURRENT_SOURCE_DIR}/libmpv/mpv.dll"
        "$<TARGET_FILE_DIR:PerdangaVSP>/mpv.dll"
)
