"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Drawer, Label, SearchField } from "@heroui/react";

export default function VideosPage() {
  const router = useRouter();

  const [videos, setVideos] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState(null);

  useEffect(() => {
    fetch("/api/videos")
      .then((response) => response.json())
      .then((data) => {
        setVideos(data);
        if (data.length > 0) {
          setSelectedTopicId(data[0].topicId);
        }
      });
  }, []);

  const filteredVideos = videos.filter((video) =>
    video.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  const groupedVideos = filteredVideos.reduce((groups, video) => {
    const topicId = video.topicId ?? "other";

    if (!groups[topicId]) {
      groups[topicId] = [];
    }

    groups[topicId].push(video);
    return groups;
  }, {});

  const topicGroups = Object.entries(groupedVideos);

  const selectedTopicVideos = groupedVideos[selectedTopicId] || [];

  const selectedTopicName =
    selectedTopicVideos[0]?.topicName || "Select a topic";

  return (
    <main className="h-screen bg-gray-100">
      {/* Main application */}
      <div className="h-full bg-white flex flex-col">
        {/* Main content */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col md:flex-row">
          <aside className="hidden md:flex w-72 gap-2 rounded-e-3xl p-2 shrink-0 border-r bg-slate-100 text-slate-700 flex-col min-h-0">
            {/* Sidebar header */}

            <div className="px-5 py-3 flex gap-2 items-center">
              <h2 className="text-lg font-semibold">Lectures</h2>
            </div>

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

            {/* Categories */}

            <div className="border-t px-4 pt-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400 uppercase">
                  Subjects
                </span>
              </div>

              {/* Subjects */}

              <div className="space-y-1">
                {topicGroups.map(([topicId, topicVideos]) => {
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
              </div>
            </div>

            {/* Latest lectures */}

            <div className="border-t mt-5 px-4 pt-5 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-400 uppercase">
                  Latest Lectures
                </span>
              </div>

              <div className="space-y-2">
                {videos.slice(0, 10).map((video) => (
                  <button
                    key={video.id}
                    onClick={() => router.push(`/player?messageId=${video.id}`)}
                    className="w-full cursor-pointer flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 text-left"
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

                      {/* Subjects */}
                      <div className="border-t pt-5">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-gray-400 uppercase">
                            Subjects
                          </span>
                        </div>

                        <div className="space-y-1">
                          {topicGroups.map(([topicId, topicVideos]) => {
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
                          {videos.slice(0, 10).map((video) => (
                            <button
                              key={video.id}
                              onClick={() =>
                                router.push(`/player?messageId=${video.id}`)
                              }
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

            <h2 className="font-semibold truncate">{selectedTopicName}</h2>
          </div>

          {/* Videos */}
          <section className="flex-1 min-h-0 min-w-0 overflow-y-auto">
            {/* Selected topic */}
            <div className="hidden md:block border-b px-6 py-4 font-semibold">
              {selectedTopicName}
            </div>

            {/* Video list */}
            <div>
              {[...selectedTopicVideos]
                .sort(
                  (firstVideo, secondVideo) => firstVideo.id - secondVideo.id,
                )
                .map((video, index) => (
                  <button
                    key={video.id}
                    onClick={() => router.push(`/player?messageId=${video.id}`)}
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
                ))}

              {selectedTopicVideos.length === 0 && (
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
