"use client";

import { useEffect, useRef, useState } from "react";

const lectureKey = "telegram--1004466834272-19";

function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));

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

function parseTimestamp(value) {
  const parts = value.trim().split(":").map(Number);

  if (parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

export default function NotesPanel({ videoRef, currentTime, onClose }) {
  const [notes, setNotes] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingTimestamp, setEditingTimestamp] = useState("");
  const [editingText, setEditingText] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [timestamp, setTimestamp] = useState("");
  const [noteText, setNoteText] = useState("");
  const importInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("lecture-notes-" + lectureKey);

    if (!saved) return;

    try {
      setNotes(JSON.parse(saved));
    } catch (error) {
      console.error("Could not load notes:", error);
    }
  }, []);

useEffect(() => {
  function handleKeyboardShortcuts(event) {
    // Ctrl + Enter = save
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();

      if (editingIndex !== null) {
        saveEditedNote();
      } else if (editorOpen) {
        saveNewNote();
      }

      return;
    }

    // Don't trigger other shortcuts while typing
    const tagName = event.target.tagName;

    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
      return;
    }

    // N = add timestamp
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      addNoteAtCurrentTime();
    }

    // Escape = close editor
    if (event.key === "Escape" && editorOpen) {
      event.preventDefault();
      setEditorOpen(false);
    }
  }

  window.addEventListener("keydown", handleKeyboardShortcuts);

  return () => {
    window.removeEventListener("keydown", handleKeyboardShortcuts);
  };
}, [
  editorOpen,
  editingIndex,
  timestamp,
  noteText,
  editingTimestamp,
  editingText,
  notes,
]);

  function saveNotes(nextNotes) {
    localStorage.setItem(
      "lecture-notes-" + lectureKey,
      JSON.stringify(nextNotes),
    );
  }

  function seekTo(seconds) {
    if (!videoRef.current) return;

    videoRef.current.currentTime = seconds;
    videoRef.current.play().catch(() => {});
  }

  function addNoteAtCurrentTime() {
    const currentVideoTime = Math.floor(videoRef.current?.currentTime || 0);

    setTimestamp(formatTime(currentVideoTime));
    setNoteText("");
    setEditorOpen(true);
  }

  function saveNewNote() {
    const parsedTimestamp = parseTimestamp(timestamp);

    if (parsedTimestamp === null) {
      alert("Please enter a valid timestamp.");
      return;
    }

    const text = noteText.trim();

    if (!text) {
      alert("Please enter a note.");
      return;
    }

    const nextNotes = [
      ...notes,
      {
        time: parsedTimestamp,
        text,
      },
    ].sort((a, b) => a.time - b.time);

    setNotes(nextNotes);
    saveNotes(nextNotes);
    setEditorOpen(false);
  }

  function deleteNote(index) {
    const nextNotes = notes.filter((_, noteIndex) => noteIndex !== index);

    setNotes(nextNotes);
    saveNotes(nextNotes);
  }

function editNote(index) {
  const note = notes[index];

  setEditingIndex(index);
  setEditingTimestamp(formatTime(note.time));
  setEditingText(note.text);
}

function saveEditedNote() {
  const parsedTime = parseTimestamp(editingTimestamp);

  if (parsedTime === null) {
    alert("Invalid timestamp.");
    return;
  }

  const text = editingText.trim();

  if (!text) {
    alert("Please enter a note.");
    return;
  }

  const nextNotes = notes
    .map((item, noteIndex) =>
      noteIndex === editingIndex
        ? {
            time: parsedTime,
            text,
          }
        : item,
    )
    .sort((a, b) => a.time - b.time);

  setNotes(nextNotes);
  saveNotes(nextNotes);

  setEditingIndex(null);
  setEditingTimestamp("");
  setEditingText("");
}

function cancelEdit() {
  setEditingIndex(null);
  setEditingTimestamp("");
  setEditingText("");
}

  function exportNotes() {
    const data = {
      video: {
        telegramChatId: "-1004466834272",
        messageId: 19,
      },
      notes,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "PW-Classes-Lecture-19.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  async function importNotes(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !Array.isArray(data.notes)) {
        throw new Error("Invalid notes file");
      }

      const nextNotes = [...data.notes].sort((a, b) => a.time - b.time);

      setNotes(nextNotes);
      saveNotes(nextNotes);
    } catch (error) {
      alert("Could not import notes.");
      console.error(error);
    }

    event.target.value = "";
  }

return (
  <aside
    id="side-panel"
    className="w-[320px] shrink-0 h-full bg-[#0e1621] border-l border-white/[0.06] flex flex-col"
  >
    {/* HEADER */}
    <div className="shrink-0 px-4 py-4 bg-[#17212b] border-b border-white/[0.07]">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-semibold text-white">Notes</div>

        <button
          type="button"
          onClick={onClose}
          className="text-white hover:text-red-400 transition-colors cursor-pointer"
          title="Close notes"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="size-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    {/* NOTES LIST */}
    <div className="flex-1 min-h-0 overflow-y-auto">
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#229ed9]/10 flex items-center justify-center mb-4">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-[#229ed9]/70"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 4h14v16H5z" />
              <path d="M8 8h8" />
              <path d="M8 12h8" />
              <path d="M8 16h5" />
            </svg>
          </div>

          <div className="text-[14px] font-medium text-white/60">
            No notes yet
          </div>

          <div className="text-[12px] text-white/30 mt-1">
            Add a timestamp while watching.
          </div>
        </div>
      ) : (
        <div className="px-2 py-3">
          {notes.map((note, index) => (
            <div key={`${note.time}-${index}`} className="group mb-1 last:mb-1">
              {/* NOTE CARD */}
              <div
                className="px-2 py-3 rounded-lg bg-[#19232d] border-l-[3px] border-transparent cursor-pointer hover:bg-[#25262e] transition-colors"
                onClick={() => seekTo(note.time)}
              >
                {editingIndex === index ? (
                  <>
                    {/* EDIT TOP ROW */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={editingTimestamp}
                        onChange={(event) =>
                          setEditingTimestamp(event.target.value)
                        }
                        onClick={(event) => event.stopPropagation()}
                        className="w-[90px] px-2 py-1 rounded-md bg-[#0e1621] border border-white/[0.08] text-[15px] font-mono text-white outline-none focus:border-[#229ed9]"
                      />

                      <div className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          title="Save"
                          onClick={(event) => {
                            event.stopPropagation();
                            saveEditedNote();
                          }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#42b5e8] hover:bg-[#229ed9]/10 transition cursor-pointer"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-[16px] h-[16px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="m5 12 4 4L19 6" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          title="Cancel"
                          onClick={(event) => {
                            event.stopPropagation();
                            cancelEdit();
                          }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9aaa] hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-[16px] h-[16px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M6 6l12 12" />
                            <path d="M18 6 6 18" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* EDIT NOTE */}
                    <textarea
                      autoFocus
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full min-h-[70px] px-2 py-2 rounded-md bg-[#0e1621] border border-white/[0.08] text-[15px] leading-[23px] text-[#c9cbd1] outline-none resize-y focus:border-[#229ed9]"
                    />
                  </>
                ) : (
                  <>
                    {/* TOP ROW */}
                    <div className="flex items-center justify-between mb-1.5">
                      {/* TIMESTAMP */}
                      <div className="text-[17px] font-semibold text-white">
                        {formatTime(note.time)}
                      </div>

                      {/* ACTIONS - HIDDEN UNTIL HOVER */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          title="Edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            editNote(index);
                          }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9aaa] hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-[16px] h-[16px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          title="Delete"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNote(index);
                          }}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#8b9aaa] hover:text-red-400 hover:bg-red-400/10 transition cursor-pointer"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="w-[16px] h-[16px]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v5" />
                            <path d="M14 11v5" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* NOTE TEXT */}
                    <div className="text-[15px] leading-[23px] text-[#c9cbd1] whitespace-pre-wrap break-words">
                      {note.text}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* EDITOR */}
    <div
      className={`${
        editorOpen ? "" : "hidden "
      }shrink-0 p-3 bg-[#17212b] border-t border-white/[0.07]`}
    >
      <input
        type="text"
        placeholder="Timestamp  12:35"
        value={timestamp}
        onChange={(event) => setTimestamp(event.target.value)}
        className="w-full mb-2 px-3 py-2.5 rounded-lg bg-[#0e1621] border border-white/[0.08] text-white text-sm outline-none placeholder:text-[#71808f] focus:border-[#229ed9]"
      />

      <textarea
        placeholder="Write your note..."
        value={noteText}
        onChange={(event) => setNoteText(event.target.value)}
        className="w-full min-h-[80px] px-3 py-2.5 rounded-lg bg-[#0e1621] border border-white/[0.08] text-white text-sm outline-none placeholder:text-[#71808f] resize-y focus:border-[#229ed9]"
      />

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={saveNewNote}
          className="flex-1 px-4 py-2.5 rounded-lg bg-[#229ed9] text-white text-sm font-semibold hover:bg-[#2aa8e4] transition"
        >
          Save
        </button>

        <button
          type="button"
          onClick={() => setEditorOpen(false)}
          className="px-4 py-2.5 rounded-lg bg-[#263441] text-white/80 text-sm hover:bg-[#30404e] transition"
        >
          Cancel
        </button>
      </div>
    </div>

    {/* BOTTOM BAR */}
    <div className="shrink-0 px-3 py-2.5 bg-[#17212b] border-t border-white/[0.07]">
      <div className="flex items-center gap-2">
        {/* Timestamp */}
        <button
          type="button"
          onClick={addNoteAtCurrentTime}
          title="Add note at current timestamp"
          className="flex-1 h-9 rounded-md bg-[#229ed9] hover:bg-[#1d8fc5] text-white text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Timestamp
        </button>

        {/* Export */}
        <button
          type="button"
          onClick={exportNotes}
          title="Export notes"
          aria-label="Export notes"
          className="size-9 shrink-0 rounded-md bg-[#202d3a] hover:bg-[#2a3a49] text-[#b8c5d0] hover:text-white transition-colors flex items-center justify-center"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </button>

        {/* Import */}
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          title="Import notes"
          aria-label="Import notes"
          className="size-9 shrink-0 rounded-md bg-[#202d3a] hover:bg-[#2a3a49] text-[#b8c5d0] hover:text-white transition-colors flex items-center justify-center"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 15V3" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          onChange={importNotes}
          className="hidden"
        />
      </div>
    </div>
  </aside>
);
}
