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

function VideoJsPlayerContent({ source, messageId, telegramChatId }) {
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

  pausedRef.current = paused;

  useEffect(() => {
    mediaRef.current = media;
    return () => {
      mediaRef.current = null;
    };
  }, [media]);

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
    function handleKeyboard(event) {
      const target = event.target;
      const isEditingText = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (isEditingText) return;

      const key = event.key.toLowerCase();
      const video = mediaRef.current;
      if ((event.code === "Space" || key === "5") && isMediaPauseCapable(video)) {
        event.preventDefault();
        event.stopPropagation();
        if (video.paused || video.ended) video.play().catch(() => {});
        else video.pause();
      } else if ((key === "arrowleft" || key === "4") && isMediaSeekCapable(video)) {
        event.preventDefault();
        event.stopPropagation();
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if ((key === "arrowright" || key === "6") && isMediaSeekCapable(video)) {
        event.preventDefault();
        event.stopPropagation();
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      } else if (key === "f") {
        event.preventDefault();
        event.stopPropagation();
        if (!document.fullscreenElement) {
          shellRef.current
            ?.closest(".videojs-test-skin")
            ?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      } else if (key === "z") {
        event.preventDefault();
        event.stopPropagation();
        setNotesVisible((visible) => !visible);
      }
    }

    document.addEventListener("keydown", handleKeyboard, true);
    return () => document.removeEventListener("keydown", handleKeyboard, true);
  }, []);

  return (
    <NeutralVideoSkin
      className={`videojs-test-skin ${notesVisible ? "videojs-test-skin-with-notes" : ""} ${pausedControlsHidden ? "videojs-test-skin-paused-controls-hidden" : ""}`}
    >
      <div className="videojs-test-content" ref={shellRef}>
        <div className="videojs-test-video-column">
          <Video key={source} src={source} playsInline preload="metadata" />
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
        {notesVisible && (
          <NotesPanel
            videoRef={mediaRef}
            currentTime={currentTime ?? 0}
            messageId={messageId}
            telegramChatId={telegramChatId}
            onClose={() => setNotesVisible(false)}
          />
        )}
      </div>
    </NeutralVideoSkin>
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
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlParams(params);
    if (window.Telegram?.WebApp) window.Telegram.WebApp.expand();
  }, []);

  const messageId = messageIdProp ?? (urlParams?.get("messageId") || "19");
  const telegramChatId =
    telegramChatIdProp ?? urlParams?.get("telegramChatId") ?? "";

  useEffect(() => {
    if (titleProp) {
      setVideoTitle(titleProp);
      return;
    }

    if (!messageId) return;
    let cancelled = false;

    fetch("/api/videos")
      .then((response) => {
        if (!response.ok) throw new Error("Could not load the video list.");
        return response.json();
      })
      .then((videos) => {
        const selectedVideo = videos.find(
          (video) =>
            String(video.id) === String(messageId) &&
            (!telegramChatId || video.telegramChatId === telegramChatId),
        );

        if (!cancelled && selectedVideo) {
          setVideoTitle(selectedVideo.name);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message);
      });

    return () => {
      cancelled = true;
    };
  }, [messageId, telegramChatId, titleProp]);

  const source = useMemo(() => {
    if (!telegramChatId || !messageId) return "";
    const params = new URLSearchParams({
      messageId: String(messageId),
      telegramChatId: String(telegramChatId),
    });
    return `/api/video?${params.toString()}`;
  }, [messageId, telegramChatId]);

  return (
    <main className={`videojs-test-page ${className}`.trim()}>
      {!source ? (
        <p className="videojs-test-message">
          Waiting for a Telegram chat ID. Pass <code>telegramChatId</code> as a
          prop or add it to the URL.
        </p>
      ) : (
        <VideoPlayer title={videoTitle}>
          <VideoJsPlayerContent
            source={source}
            messageId={messageId}
            telegramChatId={telegramChatId}
          />
        </VideoPlayer>
      )}

      {error && <p className="videojs-test-error" role="alert">{error}</p>}
    </main>
  );
}

