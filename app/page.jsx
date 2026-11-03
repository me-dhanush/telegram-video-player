"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Drawer, Label, SearchField } from "@heroui/react";

export default function VideosPage() {
  const router = useRouter();

  function openVideo(video) {
    const params = new URLSearchParams({
      messageId: String(video.id),
      telegramChatId: String(video.telegramChatId),
      title: video.name,
    });
    router.push(`/player-videojs?${params.toString()}`);
  }

  const [videos, setVideos] = useState([]);
  const [topics, setTopics] = useState([]);
  const [recentVideos, setRecentVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [searchText, setSearchText] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [localVideos, setLocalVideos] = useState([]);
  const localVideoInputRef = useRef(null);

  function addLocalVideos(event) {
    const selected = Array.from(event.target.files || []);
    console.info("[local-video] File picker returned:", selected.map(({ name, type, size }) => ({ name, type, size })));
    const additions = selected.filter((file) => file.type.startsWith("video/") || /\.(mp4|m4v|webm|mov|ogv|ogg|mkv)$/i.test(file.name));
    if (!additions.length) console.error("[local-video] No supported video file was selected.");
    setLocalVideos((current) => [...current, ...additions]);
    if (additions[0]) openLocalVideo(additions[0]);
    event.target.value = "";
  }

  function openLocalVideo(file) {
    try {
      const url = URL.createObjectURL(file);
      console.info("[local-video] Opening selected file:", { name: file.name, type: file.type, size: file.size, url });
      sessionStorage.setItem("local-video-source", url);
      sessionStorage.setItem("local-video-name", file.name);
      router.push("/player-videojs?local=1");
      console.info("[local-video] Navigated to local player route.");
    } catch (error) {
      console.error("[local-video] Could not open selected file:", error);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/videos?mode=overview").then((response) => response.json()).then((overview) => {
      if (!active) return;
      const validTopics = Array.isArray(overview?.topics) ? overview.topics : [];
      setTopics(validTopics);
      setRecentVideos(Array.isArray(overview?.recentVideos) ? overview.recentVideos : []);
      const remembered = window.localStorage.getItem("last-opened-topic");
      setSelectedTopicId(
        validTopics.some((topic) => topic.id === remembered)
          ? remembered
          : validTopics[0]?.id ?? null,
      );
    }).catch((error) => console.error("Could not load video overview", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedTopicId) return;
    window.localStorage.setItem("last-opened-topic", selectedTopicId);
    let active = true;
    setVideosLoading(true);
    fetch(`/api/videos?topicId=${encodeURIComponent(selectedTopicId)}`)
      .then((response) => response.json())
      .then((data) => { if (active) setVideos(Array.isArray(data) ? data : []); })
      .catch((error) => { if (active) { console.error("Could not load selected topic", error); setVideos([]); } })
      .finally(() => { if (active) setVideosLoading(false); });
    return () => { active = false; };
  }, [selectedTopicId]);

  const filteredVideos = videos.filter((video) =>
    video.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const groupedVideos = Object.fromEntries(topics.map((topic) => [topic.id, []]));
  for (const video of filteredVideos) {
    if (groupedVideos[video.topicId]) groupedVideos[video.topicId].push(video);
  }
  const topicGroups = topics
    .filter((topic) => topic.topicName.toLowerCase().includes(searchText.toLowerCase()) || topic.chatName.toLowerCase().includes(searchText.toLowerCase()))
    .map((topic) => [topic.id, [topic]]);

  const chatGroups = topicGroups.reduce((groups, topicGroup) => {
    const [topicId, topicVideos] = topicGroup;
    const chatId = topicVideos[0]?.chatId || "unknown";
    if (!groups[chatId]) {
      groups[chatId] = {
        name: topicVideos[0]?.chatName || "Telegram chat",
        topics: [],
      };
    }
    groups[chatId].topics.push([topicId, topicVideos]);
    return groups;
  }, {});

  const selectedTopicVideos = groupedVideos[selectedTopicId] || [];

  const selectedTopicName =
    topics.find((topic) => topic.id === selectedTopicId)?.topicName || "Select a topic";

  return (
    <main className="h-screen bg-gray-100">
      {/* Main application */}
      <div className="h-full bg-white flex flex-col">
        {/* Main content */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col md:flex-row">
          <aside className="hidden md:flex w-72 gap-2 rounded-e-3xl p-2 shrink-0 border-r bg-slate-100 text-slate-700 flex-col min-h-0 overflow-y-auto">
            {/* Sidebar header */}

            <div className="px-5 py-3 flex gap-2 items-center">
              <h2 className="text-lg font-semibold">Lectures</h2>
            </div>
            <button type="button" onClick={() => localVideoInputRef.current?.click()} className="mx-4 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white">Choose local videos</button>
            {localVideos.map((file, index) => <button type="button" key={`${file.name}-${index}`} onClick={() => openLocalVideo(file)} className="mx-4 truncate rounded px-2 py-1 text-left text-sm hover:bg-white">▶ {file.name}</button>)}

            {/* Search */}

            <div className="px-4 pb-5">
              <SearchField
                fullWidth
                name="search"
                value={searchText}
                onChange={setSearchText}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />

                  <SearchField.Input placeholder="Search..." />

                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </div>

            {/* Class sections */}
            <div className="border-t px-4 pt-3 shrink-0">
              <div className="space-y-1">
                {Object.entries(chatGroups).map(([chatId, chat]) => (
                  <section key={chatId} aria-label={chat.name} className="mb-4 border-b border-slate-200 pb-3 last:border-0">
                    <h3 className="px-3 py-2 text-sm font-semibold text-slate-700">
                      {chat.name}
                    </h3>
                    {chat.topics.map(([topicId, topicVideos]) => {
                  const topicName =
                    topicVideos[0]?.topicName || `Topic ${topicId}`;

                  const isSelected =
                    String(selectedTopicId) === String(topicId);

                  return (
                    <button
                      key={topicId}
                      onClick={() => setSelectedTopicId(topicId)}
                      className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${
                        isSelected
                          ? "bg-sky-400 text-white"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {/* Folder icon */}

                      <span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="size-6"
                        >
                          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
                        </svg>
                      </span>

                      {/* Topic name */}

                      <span className="flex-1 truncate text-sm">
                        {topicName}
                      </span>

                      {/* Arrow */}

                      <span>›</span>
                    </button>
                  );
                    })}
                  </section>
                ))}
              </div>
            </div>

            {/* Latest lectures */}

            <div className="border-t mt-5 px-2 pt-5 shrink-0">
              <div className="flex items-center justify-between ms-3 mb-4">
                <span className="text-xs text-gray-400 uppercase">
                  Latest Lectures
                </span>
              </div>

              <div className="space-y-2">
                {recentVideos.map((video) => (
                  <button
                    key={`${video.telegramChatId}:${video.id}`}
                    onClick={() => openVideo(video)}
                    className="w-full cursor-pointer flex items-center gap-3 p-2 rounded-lg bg-white hover:bg-gray-50 text-left"
                  >
                    {/* File icon */}

                    <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
                      📄
                    </div>

                    {/* Lecture name */}

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 truncate">
                        {video.name}
                      </div>

                      <div className="text-[10px] text-gray-400 mt-1">
                        Lecture
                      </div>
                    </div>

                    {/* More */}

                    <span className="text-gray-400">⋯</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
          {/* Mobile header */}
          <div className="md:hidden border-b px-4 py-3 flex items-center gap-3">
            <button type="button" onClick={() => localVideoInputRef.current?.click()} className="shrink-0 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white">Open local video</button>
            <input ref={localVideoInputRef} type="file" accept="video/*,.mp4,.m4v,.webm,.mov,.ogv" aria-label="Choose local video file" className="hidden" onChange={addLocalVideos} />
            {localVideos.length > 0 && <select aria-label="Selected local videos" defaultValue="" onChange={(event) => { const file = localVideos[Number(event.target.value)]; if (file) openLocalVideo(file); }} className="max-w-32 truncate rounded border px-2 py-2 text-xs"><option value="">Open selected…</option>{localVideos.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select>}
            <Drawer>
              <Button isIconOnly variant="secondary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
                    clipRule="evenodd"
                  />
                </svg>
              </Button>

              <Drawer.Backdrop variant="opaque">
                <Drawer.Content placement="left">
                  <Drawer.Dialog className="w-72">
                    <Drawer.CloseTrigger />

                    <Drawer.Header>
                      <Drawer.Heading>Lectures</Drawer.Heading>
                    </Drawer.Header>

                    <Drawer.Body>
                      {/* Search */}
                      <div className="pb-5">
                        <SearchField
                          fullWidth
                          name="search"
                          value={searchText}
                          onChange={setSearchText}
                        >
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Search..." />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                      </div>

                      {/* Class sections */}
                      <div className="border-t pt-3">
                        <div className="space-y-1">
                          {Object.entries(chatGroups).map(([chatId, chat]) => (
                            <section key={chatId} aria-label={chat.name} className="mb-4 border-b border-slate-200 pb-3 last:border-0">
                              <h3 className="px-3 py-2 text-sm font-semibold text-slate-700">
                                {chat.name}
                              </h3>
                              {chat.topics.map(([topicId, topicVideos]) => {
                            const topicName =
                              topicVideos[0]?.topicName || `Topic ${topicId}`;

                            const isSelected =
                              String(selectedTopicId) === String(topicId);

                            return (
                              <button
                                key={topicId}
                                onClick={() => setSelectedTopicId(topicId)}
                                className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${
                                  isSelected
                                    ? "bg-sky-400 text-white"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                <span>
                                  {/* folder icon */}
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="size-6"
                                  >
                                    <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
                                  </svg>
                                </span>

                                <span className="flex-1 truncate text-sm">
                                  {topicName}
                                </span>

                                <span>›</span>
                              </button>
                            );
                              })}
                            </section>
                          ))}
                        </div>
                      </div>

                      {/* Latest lectures */}
                      <div className="border-t mt-5 pt-5">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-gray-400 uppercase">
                            Latest Lectures
                          </span>
                        </div>

                        <div className="space-y-2">
                          {recentVideos.map((video) => (
                            <button
                              key={`${video.telegramChatId}:${video.id}`}
                              onClick={() => openVideo(video)}
                              className="w-full cursor-pointer flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left"
                            >
                              <div className="w-9 h-9 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center">
                                📄
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-700 truncate">
                                  {video.name}
                                </div>

                                <div className="text-[10px] text-gray-400 mt-1">
                                  Lecture
                                </div>
                              </div>

                              <span className="text-gray-400">⋯</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </Drawer.Body>
                  </Drawer.Dialog>
                </Drawer.Content>
              </Drawer.Backdrop>
            </Drawer>
          </div>

          {/* Videos */}
          <section className="flex-1 min-h-0 min-w-0 overflow-y-auto">
            {/* Selected topic */}
            <div className="border-b px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3">
              <h2 className="font-semibold truncate">{selectedTopicName}</h2>
              <div className="flex shrink-0 rounded-lg border bg-slate-50 p-1" aria-label="Video layout">
                <button type="button" aria-label="List view" title="List view" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={`cursor-pointer rounded-md p-2 ${viewMode === "list" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12m-12 5.25h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75Zm0 5.25h.008v.008H3.75V12Zm0 5.25h.008v.008H3.75v-.008Z" />
                  </svg>
                </button>
                <button type="button" aria-label="Grid view" title="Grid view" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={`cursor-pointer rounded-md p-2 ${viewMode === "grid" ? "bg-white shadow text-slate-900" : "text-slate-500"}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h7.5v7.5h-7.5v-7.5Zm9 0h7.5v7.5h-7.5v-7.5Zm-9 9h7.5v7.5h-7.5v-7.5Zm9 0h7.5v7.5h-7.5v-7.5Z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Video list */}
            <div className={viewMode === "grid" ? "grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : ""}>
              {[...selectedTopicVideos].sort((firstVideo, secondVideo) => firstVideo.id - secondVideo.id).map((video, index) => (
                viewMode === "grid" ? (
                  <button key={`${video.telegramChatId}:${video.id}`} onClick={() => openVideo(video)} className="cursor-pointer overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:shadow-md">
                    <div className="relative aspect-video bg-slate-200 flex items-center justify-center text-3xl text-slate-400">
                      <span aria-hidden="true">▶</span>
                      <img
                        src={`/api/thumbnail?messageId=${encodeURIComponent(video.id)}&telegramChatId=${encodeURIComponent(video.telegramChatId)}`}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(event) => { event.currentTarget.style.display = "none"; }}
                      />
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-medium text-slate-800">{video.name}</div>
                      <div className="mt-2 text-xs text-slate-500">Lecture {index + 1}</div>
                    </div>
                  </button>
                ) : (
                  <button
                    key={`${video.telegramChatId}:${video.id}`}
                    onClick={() => openVideo(video)}
                    className="w-full cursor-pointer flex items-center gap-4 px-6 py-4 border-b text-left hover:bg-gray-50"
                  >
                    {/* Lecture number */}
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gray-200 flex items-center justify-center">
                      {index + 1}
                    </div>

                    {/* Lecture information */}
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{video.name}</div>

                      <div className="text-sm text-gray-500 mt-1">
                        Tap to play
                      </div>
                    </div>

                    {/* Play button */}
                    <div className="w-9 h-9 shrink-0 rounded-full bg-gray-200 flex items-center justify-center">
                      ▶
                    </div>
                  </button>
                )
              ))}

              {videosLoading && (
                <div className="p-12 text-center text-gray-500">Loading lectures…</div>
              )}

              {!videosLoading && selectedTopicVideos.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  No lectures found
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
