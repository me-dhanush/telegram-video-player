"use client";

import {
  isMediaPauseCapable,
  isMediaSeekCapable,
  useMedia,
  usePlayer,
} from "@videojs/react";
import { NeutralVideoSkin, Video, VideoPlayer } from "@videojs/react/video";
import { useEffect, useMemo, useRef, useState } from "react";
import NotesPanel from "./NotesPanel";

function VideoJsPlayerContent({ source, messageId, telegramChatId, local = false }) {
  const media = useMedia();
  const currentTime = usePlayer((state) => state.currentTime);
  const controlsVisible = usePlayer((state) => state.controlsVisible);
  const paused = usePlayer((state) => state.paused);
  const shellRef = useRef(null);
  const mediaRef = useRef(null);
  const pausedRef = useRef(paused);
  const hidePausedControlsTimerRef = useRef(null);
  const [notesVisible, setNotesVisible] = useState(false);
  const [pausedControlsHidden, setPausedControlsHidden] = useState(false);
  const layoutRef = useRef(null);

  pausedRef.current = paused;

  useEffect(() => {
    mediaRef.current = media;
    return () => {
      mediaRef.current = null;
    };
  }, [media]);

  useEffect(() => {
    const video = mediaRef.current;
    if (!video || typeof video.addEventListener !== "function") return;

    let localName = "local-video";
    if (local) {
      try {
        localName = window.sessionStorage.getItem("local-video-name") || localName;
      } catch {}
    }
    const storageKey = local
      ? `videojs-resume:local:${localName}`
      : `videojs-resume:${telegramChatId || "default"}:${messageId}`;
    let restored = false;

    const restorePosition = () => {
      if (restored || !Number.isFinite(video.duration)) return;
      restored = true;

      try {
        const savedPosition = Number(window.localStorage.getItem(storageKey));
        if (Number.isFinite(savedPosition) && savedPosition > 0 && savedPosition < video.duration) {
          video.currentTime = savedPosition;
        }
      } catch (error) {
        console.warn("Could not restore playback position:", error);
      }
    };

    const savePosition = () => {
      if (!Number.isFinite(video.currentTime) || video.currentTime <= 0) return;
      try {
        window.localStorage.setItem(storageKey, String(video.currentTime));
      } catch (error) {
        console.warn("Could not save playback position:", error);
      }
    };

    video.addEventListener("loadedmetadata", restorePosition);
    video.addEventListener("timeupdate", savePosition);
    video.addEventListener("pause", savePosition);
    window.addEventListener("pagehide", savePosition);
    if (video.readyState >= 1) restorePosition();

    return () => {
      savePosition();
      video.removeEventListener("loadedmetadata", restorePosition);
      video.removeEventListener("timeupdate", savePosition);
      video.removeEventListener("pause", savePosition);
      window.removeEventListener("pagehide", savePosition);
    };
  }, [media, source, messageId, telegramChatId, local]);

  useEffect(() => {
    const revealAndScheduleHide = () => {
      setPausedControlsHidden(false);
      window.clearTimeout(hidePausedControlsTimerRef.current);
      if (pausedRef.current) {
        hidePausedControlsTimerRef.current = window.setTimeout(() => {
          setPausedControlsHidden(true);
        }, 2000);
      }
    };

    const shell = shellRef.current;
    shell?.addEventListener("pointermove", revealAndScheduleHide);
    shell?.addEventListener("pointerdown", revealAndScheduleHide);

    if (paused) revealAndScheduleHide();
    else {
      window.clearTimeout(hidePausedControlsTimerRef.current);
      setPausedControlsHidden(false);
    }

    return () => {
      shell?.removeEventListener("pointermove", revealAndScheduleHide);
      shell?.removeEventListener("pointerdown", revealAndScheduleHide);
      window.clearTimeout(hidePausedControlsTimerRef.current);
    };
  }, [paused]);

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const syncFullscreenButton = () => {
      const button = layout.querySelector(".media-fullscreen-button");
      const isFullscreen = document.fullscreenElement === layout;
      button?.toggleAttribute("data-fullscreen", isFullscreen);
      button?.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
      button?.setAttribute("title", isFullscreen ? "Exit fullscreen" : "Fullscreen");
      if (isFullscreen && document.activeElement === button) {
        button.blur();
        layout.focus({ preventScroll: true });
      }
    };

    const handleFullscreenClick = (event) => {
      if (!event.target.closest?.(".media-fullscreen-button")) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.fullscreenElement) document.exitFullscreen?.();
      else layout.requestFullscreen?.();
    };

    layout.addEventListener("click", handleFullscreenClick, true);
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    syncFullscreenButton();
    return () => {
      layout.removeEventListener("click", handleFullscreenClick, true);
      document.removeEventListener("fullscreenchange", syncFullscreenButton);
    };
  }, []);

  useEffect(() => {
    function handleKeyboard(event) {
      const target = event.target;
      const isEditingText = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isEditingText) return;

      if (event.code === "Space" && document.fullscreenElement === layoutRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const video = mediaRef.current;
        if (video?.paused || video?.ended) video?.play?.().catch(() => {});
        else video?.pause?.();
        return;
      }

      const key = event.key.toLowerCase();
      const video = mediaRef.current;
      if ((event.code === "Space" || key === "5") && isMediaPauseCapable(video)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (video.paused || video.ended) video.play().catch(() => {});
        else video.pause();
      } else if ((key === "arrowleft" || key === "4") && isMediaSeekCapable(video)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if ((key === "arrowright" || key === "6") && isMediaSeekCapable(video)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      } else if (key === "f") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!document.fullscreenElement) {
          layoutRef.current?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      } else if (key === "z") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setNotesVisible((visible) => !visible);
      }
    }

    window.addEventListener("keydown", handleKeyboard, true);
    return () => window.removeEventListener("keydown", handleKeyboard, true);
  }, []);

  return (
    <div className="videojs-test-layout" ref={layoutRef} tabIndex={-1}>
      <NeutralVideoSkin
        className={`videojs-test-skin ${pausedControlsHidden ? "videojs-test-skin-paused-controls-hidden" : ""}`}
      >
      <div className="videojs-test-content" ref={shellRef}>
        <div className="videojs-test-video-column">
          <Video key={source} src={source} playsInline preload="auto" />
          <div
            className={`videojs-test-player-actions ${controlsVisible ? "is-visible" : ""}`}
          >
            <a
              href="/"
              className="videojs-library-icon-button"
              aria-label="Back to library"
              title="Back to library"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </a>
            <button
              type="button"
                className="videojs-notes-icon-button"
                aria-label={notesVisible ? "Hide notes" : "Show notes"}
                aria-pressed={notesVisible}
                title={notesVisible ? "Hide notes" : "Show notes"}
              onClick={() => setNotesVisible((visible) => !visible)}
            >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10" />
                  <path d="M8 3v4M3 7h5M8 11H5M8 15H5" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v7" />
                  <path d="m15 14 4-4 3 3-4 4-4 1z" />
                </svg>
            </button>
          </div>
        </div>
      </div>
      </NeutralVideoSkin>
      {notesVisible && (
        <NotesPanel
          videoRef={mediaRef}
          currentTime={currentTime ?? 0}
          messageId={messageId}
          telegramChatId={telegramChatId}
          local={local}
          onClose={() => setNotesVisible(false)}
        />
      )}
    </div>
  );
}

/**
 * Video.js 10 test player.
 *
 * Accepts the same identifiers used by LecturePlayer:
 *   <VideoJsTestPlayer messageId={video.id} telegramChatId={video.telegramChatId} />
 * Identifiers can also be read from the current URL.
 */
export default function VideoJsTestPlayer({
  messageId: messageIdProp,
  telegramChatId: telegramChatIdProp,
  title: titleProp,
  className = "",
}) {
  const [urlParams, setUrlParams] = useState(null);
  const [videoTitle, setVideoTitle] = useState(titleProp || "Loading video...");
  const [localSource, setLocalSource] = useState("");
  const [localTitle, setLocalTitle] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams(params);
    if (params.get("local") === "1") {
      const savedSource = sessionStorage.getItem("local-video-source") || "";
      const savedTitle = sessionStorage.getItem("local-video-name") || "Local video";
      console.info("[local-video] Player route loaded:", { hasSource: Boolean(savedSource), title: savedTitle, source: savedSource });
      if (!savedSource) console.error("[local-video] No local video source found in session storage.");
      setLocalSource(savedSource);
      setLocalTitle(savedTitle);
    }
    if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
  }, []);

  const messageId = messageIdProp ?? (urlParams?.get("messageId") || "19");
  const telegramChatId =
    telegramChatIdProp ?? urlParams?.get("telegramChatId") ?? "";
  const local = urlParams?.get("local") === "1";
  const urlTitle = urlParams?.get("title") || "";

  useEffect(() => {
    setVideoTitle(titleProp || urlTitle || `Video ${messageId}`);
  }, [messageId, titleProp, urlTitle]);

  const telegramSource = useMemo(() => {
    if (!telegramChatId || !messageId) return "";
    const params = new URLSearchParams({
      messageId: String(messageId),
      telegramChatId: String(telegramChatId),
    });
    return `/api/video?${params.toString()}`;
  }, [messageId, telegramChatId]);
  const source = local ? localSource : telegramSource;

  useEffect(() => {
    if (!local || !localSource) return;
    const video = document.querySelector(".videojs-test-video-column video");
    if (!video) {
      console.error("[local-video] Player video element was not mounted.");
      return;
    }
    const handleError = () => console.error("[local-video] Browser media error:", { code: video.error?.code, message: video.error?.message, source: localSource });
    const handleLoaded = () => console.info("[local-video] Video metadata loaded:", { duration: video.duration, videoWidth: video.videoWidth, videoHeight: video.videoHeight });
    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleLoaded);
    return () => { video.removeEventListener("error", handleError); video.removeEventListener("loadedmetadata", handleLoaded); };
  }, [local, localSource]);

  return (
    <main className={`videojs-test-page ${className}`.trim()}>
      {!source ? (
        <p className="videojs-test-message">
          Waiting for a Telegram chat ID. Pass <code>telegramChatId</code> as a
          prop or add it to the URL.
        </p>
      ) : (
        <VideoPlayer title={local ? localTitle : videoTitle}>
          <VideoJsPlayerContent
            source={source}
            messageId={messageId}
            telegramChatId={telegramChatId}
            local={local}
          />
        </VideoPlayer>
      )}

    </main>
  );
}

