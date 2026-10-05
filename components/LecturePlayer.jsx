"use client";

import { useEffect, useRef, useState } from "react";
import NotesPanel from "./NotesPanel";
import VolumeSlider from "./VolumeSlider";
import { Button, Dropdown, Label } from "@heroui/react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";

  seconds = Math.floor(seconds);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(remainingSeconds).padStart(2, "0")
    );
  }

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );
}

export default function LecturePlayer() {
  const videoRef = useRef(null);
  const videoColumnRef = useRef(null);
  const shellRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [lectureTitle, setLectureTitle] = useState("Loading...");
  const [messageId, setMessageId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [notesVisible, setNotesVisible] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().catch((error) => {
        console.error("Play failed:", error);
      });
    } else {
      video.pause();
    }
  }

  function seekBy(seconds) {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(
      0,
      Math.min(video.duration || Infinity, video.currentTime + seconds),
    );
  }

  function handleVolumeChange(event) {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = Number(event.target.value);

    video.volume = newVolume / 100;
    setVolume(newVolume);

    if (newVolume === 0) {
      video.muted = true;
      setIsMuted(true);
    } else {
      video.muted = false;
      setIsMuted(false);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function changePlaybackSpeed(speed) {
    const video = videoRef.current;

    if (!video) return;

    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  }

  function updateProgress() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const percentage = (video.currentTime / video.duration) * 100;

    setCurrentTime(video.currentTime);
    setDuration(video.duration);
    setProgress(percentage);
  }

  function handleSeek(event) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;

    const percentage = Number(event.target.value);

    video.currentTime = (percentage / 100) * video.duration;
    setProgress(percentage);
    setCurrentTime(video.currentTime);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen();

        if (screen.orientation?.lock) {
          try {
            await screen.orientation.lock("landscape");
          } catch (error) {
            console.log("Orientation lock failed:", error);
          }
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed:", error);
    }
  }

  async function handleMobileTap() {
    const video = videoRef.current;

    if (!video) return;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) return;

    try {
      if (!document.fullscreenElement) {
        await shellRef.current?.requestFullscreen();
      }

      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape");
      }

      if (video.paused) {
        await video.play();
      }
    } catch (error) {
      console.log("Mobile fullscreen/orientation failed:", error);
    }
  }

  function showVideoControls() {
    setControlsVisible(true);

    clearTimeout(controlsTimeoutRef.current);

    if (!videoRef.current?.paused) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2000);
    }
  }

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.expand();
    }

    const video = videoRef.current;
    if (!video) return;

    const searchParams = new URLSearchParams(window.location.search);
    const messageId = searchParams.get("messageId");

    setMessageId(Number(messageId) || 19);

    video.src = messageId ? `/api/video?messageId=${messageId}` : "/api/video";

    fetch("/api/videos")
      .then((response) => response.json())
      .then((videos) => {
        const selectedMessageId = Number(messageId) || 19;

        const selectedVideo = videos.find(
          (video) => video.id === selectedMessageId,
        );

        if (selectedVideo) {
          setLectureTitle(selectedVideo.name);
        }
      });

    const handlePlay = () => {
      setIsPlaying(true);
      showVideoControls();
    };

    const handlePause = () => {
      setIsPlaying(false);
      clearTimeout(controlsTimeoutRef.current);
      setControlsVisible(true);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setControlsVisible(true);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      updateProgress();
    };

    const handleMouseMove = () => {
      showVideoControls();
    };

    const handleVideoTap = (event) => {
      if (event.target !== video) return;

      setControlsVisible((visible) => !visible);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoColumnRef.current?.addEventListener("mousemove", handleMouseMove);
    videoColumnRef.current?.addEventListener("click", handleVideoTap);
    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("timeupdate", updateProgress);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoColumnRef.current?.removeEventListener("mousemove", handleMouseMove);
      videoColumnRef.current?.removeEventListener("click", handleVideoTap);
      clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    function handleKeyboard(event) {
      const activeElement = document.activeElement;

      const isTyping =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA");

      if (isTyping) return;

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      }

      if (event.key === "ArrowLeft" || event.key === "4") {
        seekBy(-10);
      }

      if (event.key === "ArrowRight" || event.key === "6") {
        seekBy(10);
      }

      if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }

      if (event.key.toLowerCase() === "z") {
        setNotesVisible((visible) => !visible);
      }
    }

    document.addEventListener("keydown", handleKeyboard);

    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, []);

  return (
    <>
      <div
        id="shell"
        ref={shellRef}
        className="fixed inset-0 flex flex-col bg-black"
      >
        {/* =========================
             MAIN ROW
        ========================== */}
        <div id="main-row" className="flex flex-1 min-h-0 overflow-hidden">
          {/* =========================
                 VIDEO
            ========================== */}
          <div
            id="video-col"
            className="relative flex-1 min-w-0 min-h-0 bg-black"
            ref={videoColumnRef}
          >
            <div
              id="vid-box"
              className="absolute inset-0 flex items-center justify-center bg-black"
            >
              <video
                ref={videoRef}
                id="video"
                preload="metadata"
                className="w-full h-full object-contain bg-black"
              ></video>
            </div>
            {/* =========================
                     PLAYER HEADER OVERLAY
                ========================== */}
            <div
              id="ctrl-overlay"
              className={`absolute inset-0 z-20 flex flex-col justify-between pointer-events-none ${
                controlsVisible ? "opacity-100" : "opacity-0"
              } transition-opacity duration-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]`}
            >
              <div
                id="player-header"
                className="flex items-center gap-2 shrink-0 px-3.5 py-2.5 bg-gradient-to-b from-black/75 to-transparent pointer-events-auto"
              >
                {/* Back */}
                <button
                  className="hdr-back flex items-center justify-center p-1.5 rounded-lg text-white hover:bg-white/10 active:scale-90 transition"
                  type="button"
                  onClick={() => window.history.back()}
                  aria-label="Back"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-6"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.03 3.97a.75.75 0 0 1 0 1.06l-6.22 6.22H21a.75.75 0 0 1 0 1.5H4.81l6.22 6.22a.75.75 0 1 1-1.06 1.06l-7.5-7.5a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>
                {/* Lecture title */}
                <div
                  id="player-title"
                  className="flex-1 min-w-0 text-sm font-medium text-white truncate"
                >
                  {lectureTitle}
                </div>
                {/* Menu */}
                <button
                  id="tdBtn"
                  type="button"
                  className="flex items-center justify-center p-1.5 rounded-lg text-white hover:bg-white/10 transition"
                  aria-label="More"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-[22px] h-[22px]"
                    fill="currentColor"
                  >
                    <circle cx="12" cy="6" r="1.5"></circle>
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="18" r="1.5"></circle>
                  </svg>
                </button>
              </div>
              {/* =========================
                         CENTER PLAY CONTROLS
                    ========================== */}
              <div
                id="ctrl-mid"
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between px-[clamp(60px,11vw,96px)] pointer-events-none transition-opacity duration-300 opacity-100"
              >
                {/* -10 seconds */}
                <button
                  onClick={() => seekBy(-10)}
                  id="midRwBtn"
                  className="mid-btn pointer-events-auto p-2 text-white cursor-pointer opacity-80 hover:opacity-100 hover:scale-110 active:scale-90 transition-all duration-150"
                  type="button"
                  title="Back 10 seconds"
                >
                  <div className="flex flex-col items-center leading-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-8"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10.72 11.47a.75.75 0 0 0 0 1.06l7.5 7.5a.75.75 0 1 0 1.06-1.06L12.31 12l6.97-6.97a.75.75 0 0 0-1.06-1.06l-7.5 7.5Z"
                        clipRule="evenodd"
                      ></path>
                      <path
                        fillRule="evenodd"
                        d="M4.72 11.47a.75.75 0 0 0 0 1.06l7.5 7.5a.75.75 0 1 0 1.06-1.06L6.31 12l6.97-6.97a.75.75 0 0 0-1.06-1.06l-7.5 7.5Z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </div>
                </button>
                <button
                  onClick={togglePlay}
                  id="midPlayBtn"
                  type="button"
                  className="pointer-events-auto cursor-pointer text-white hover:scale-110 active:scale-95 transition-transform"
                >
                  {/* Play */}
                  <svg
                    id="midIPlay"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`size-10 ${isPlaying ? "hidden" : ""}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                      clipRule="evenodd"
                    ></path>
                  </svg>

                  {/* Pause */}
                  <svg
                    id="midIPause"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`size-10 ${isPlaying ? "" : "hidden"}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.75 5.25A2.25 2.25 0 0 1 9 7.5v9a2.25 2.25 0 1 1-4.5 0v-9A2.25 2.25 0 0 1 6.75 5.25Zm8.25 0A2.25 2.25 0 0 1 17.25 7.5v9a2.25 2.25 0 1 1-4.5 0v-9A2.25 2.25 0 0 1 15 5.25Z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </button>
                {/* +10 seconds */}
                <button
                  onClick={() => seekBy(10)}
                  id="midFwBtn"
                  className="mid-btn pointer-events-auto p-2 text-white cursor-pointer opacity-80 hover:opacity-100 hover:scale-110 active:scale-90 transition-all duration-150"
                  type="button"
                  title="Forward 10 seconds"
                >
                  <div className="flex flex-col items-center leading-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="size-8"
                    >
                      <path
                        fillRule="evenodd"
                        d="M13.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L11.69 12 4.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z"
                        clipRule="evenodd"
                      ></path>
                      <path
                        fillRule="evenodd"
                        d="M19.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06L17.69 12l-6.97-6.97a.75.75 0 0 1 1.06-1.06l7.5 7.5Z"
                        clipRule="evenodd"
                      ></path>
                    </svg>
                  </div>
                </button>
              </div>
              {/* =========================
                         PLAYER FOOTER
                    ========================== */}
              <div
                id="player-footer"
                className="shrink-0 px-0 pb-2.5 pt-1 bg-gradient-to-t from-black/85 to-transparent pointer-events-auto"
              >
                {/* Time */}
                <div className="flex items-center justify-between px-3.5 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      id="curTime"
                      className="text-[13px] font-medium font-mono text-white"
                    >
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-white/40">/</span>
                    <span
                      id="durTime"
                      className="text-[13px] font-medium font-mono text-white/80"
                    >
                      {formatTime(duration)}
                    </span>
                  </div>
                  <span
                    id="spdBadge"
                    className="hidden bg-white text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded"
                  >
                    1x
                  </span>
                </div>
                {/* Progress */}
                <div
                  id="barWrap"
                  className="relative h-[22px] flex items-center px-3.5 cursor-pointer"
                >
                  <div className="absolute left-3.5 right-3.5 h-1 bg-white/20 rounded-full overflow-hidden">
                    <div
                      id="barBuf"
                      className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-full"
                      style={{ width: "0%" }}
                    ></div>
                    <div
                      id="barFill"
                      className="absolute left-0 top-0 bottom-0 rounded-full"
                      style={{
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #60a5fa, #2563eb)",
                      }}
                    ></div>
                  </div>
                  <div
                    id="barThumb"
                    className="absolute top-1/2 left-3.5 right-3.5 h-3.5 -translate-y-1/2 pointer-events-none"
                  >
                    <div
                      id="barThumbCircle"
                      className="absolute top-1/2 left-0 w-3.5 h-3.5 bg-white rounded-full -translate-y-1/2 -translate-x-1/2 shadow-lg"
                      style={{ left: `${progress}%` }}
                    ></div>
                  </div>
                  <input
                    id="seekBar"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    type="range"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={handleSeek}
                  />
                </div>
                {/* Bottom buttons */}
                <div className="flex items-center justify-between px-1.5">
                  <div className="flex items-center group">
                    <button
                      id="muteBtn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:scale-90 transition"
                      type="button"
                      onClick={toggleMute}
                    >
                      {isMuted ? (
                        // Muted
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          class="size-6"
                        >
                          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z" />
                        </svg>
                      ) : (
                        // Normal
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                          <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
                        </svg>
                      )}
                    </button>

                    <VolumeSlider
                      value={volume}
                      onChange={(newVolume) => {
                        const video = videoRef.current;
                        if (!video) return;

                        video.volume = newVolume / 100;
                        setVolume(newVolume);

                        if (newVolume === 0) {
                          video.muted = true;
                          setIsMuted(true);
                        } else {
                          video.muted = false;
                          setIsMuted(false);
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-center">
                    <button
                      id="tlBtn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:scale-90 transition"
                      type="button"
                      title="Notes"
                      onClick={() => setNotesVisible((visible) => !visible)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-6"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 5.25Zm0 4.5A.75.75 0 0 1 3.75 9h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 9.75Zm0 4.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Zm0 4.5a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                    </button>
                    <button
                      id="atBtn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:scale-90 transition"
                      type="button"
                      title="Attachments"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-6"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.125 3C3.089 3 2.25 3.84 2.25 4.875V18a3 3 0 0 0 3 3h15a3 3 0 0 1-3-3V4.875C17.25 3.839 16.41 3 15.375 3H4.125ZM12 9.75a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5H12Zm-.75-2.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H12a.75.75 0 0 1-.75-.75ZM6 12.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5H6Zm-.75 3.75a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75ZM6 6.75a.75.75 0 0 0-.75.75v3c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3A.75.75 0 0 0 9 6.75H6Z"
                          clipRule="evenodd"
                        ></path>
                        <path d="M18.75 6.75h1.875c.621 0 1.125.504 1.125 1.125V18a1.5 1.5 0 0 1-3 0V6.75Z"></path>
                      </svg>
                    </button>
                    <Dropdown>
                      <Button
                        id="settBtn"
                        aria-label="Playback speed"
                        className="w-11 h-11 min-w-11 p-0 rounded-lg bg-transparent text-white hover:bg-white/[0.08] active:scale-90 transition-colors"
                      >
                        <span className="text-xs font-medium">
                          {playbackSpeed}x
                        </span>
                      </Button>

                      <Dropdown.Popover className="min-w-[110px] p-1 rounded-lg bg-[#17212b] border border-white/[0.07] shadow-xl">
                        <Dropdown.Menu
                          aria-label="Playback speed"
                          selectedKeys={new Set([String(playbackSpeed)])}
                          selectionMode="single"
                          onSelectionChange={(keys) => {
                            const selectedSpeed = Array.from(keys)[0];

                            if (selectedSpeed) {
                              changePlaybackSpeed(Number(selectedSpeed));
                            }
                          }}
                          className="outline-none"
                        >
                          <Dropdown.Item
                            id="0.5"
                            textValue="0.5x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">0.5x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="0.75"
                            textValue="0.75x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">0.75x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="1"
                            textValue="1x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">1x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="1.25"
                            textValue="1.25x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">1.25x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="1.5"
                            textValue="1.5x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">1.5x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="1.75"
                            textValue="1.75x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">1.75x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>

                          <Dropdown.Item
                            id="2"
                            textValue="2x"
                            className="h-9 px-3 rounded-md text-[13px] text-white bg-transparent! data-[hovered=true]:!bg-[#202d3a] data-[selected=true]:!bg-[#229ed9]"
                          >
                            <Label className="text-white">2x</Label>
                            <Dropdown.ItemIndicator />
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                    <button
                      id="fullscreenBtn"
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-white hover:bg-white/10 active:scale-90 transition"
                      type="button"
                      title="Fullscreen"
                      onClick={toggleFullscreen}
                    >
                      <svg
                        id="fullscreenEnterIcon"
                        viewBox="0 0 24 24"
                        className={`w-[21px] h-[21px] ${isFullscreen ? "hidden" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                        <path d="M16 3h3a2 2 0 0 1 2 2v3"></path>
                        <path d="M21 16v3a2 2 0 0 1-2 2h-3"></path>
                        <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
                      </svg>
                      <svg
                        id="fullscreenExitIcon"
                        viewBox="0 0 24 24"
                        className={`w-[21px] h-[21px] ${isFullscreen ? "" : "hidden"}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M9 3v6H3"></path>
                        <path d="M15 3v6h6"></path>
                        <path d="M9 21v-6H3"></path>
                        <path d="M15 21v-6h6"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {notesVisible && (
            <NotesPanel
              videoRef={videoRef}
              currentTime={currentTime}
              messageId={messageId}
              onClose={() => setNotesVisible(false)}
            />
          )}
        </div>
      </div>
    </>
  );
}
