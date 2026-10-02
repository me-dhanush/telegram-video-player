"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    <main
      style={{
        minHeight: "100vh",
        background: "#e7f3fc",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "calc(100vh - 0px)",
          background: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 30px rgba(0, 120, 200, 0.15)",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: "64px",
            flexShrink: 0,
            background: "#ffffff",
            borderBottom: "1px solid #e1e8ed",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            color: "#202b33",
          }}
        >
          {/* App title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: "18px",
                fontWeight: "700",
                letterSpacing: "-0.2px",
              }}
            >
              Classes
            </div>
          </div>

          {/* Search */}
          <div
            style={{
              position: "relative",
              width: "250px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "18px",
                height: "18px",
                color: "#8b9aa6",
                pointerEvents: "none",
              }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>

            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search lectures..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "9px 12px 9px 34px",
                border: "1px solid #dce5eb",
                borderRadius: "8px",
                outline: "none",
                background: "#f7f9fb",
                color: "#202b33",
                fontSize: "13px",
              }}
            />
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            minHeight: 0,
          }}
        >
          {/* Topics */}
          <div
            style={{
              width: "260px",
              flexShrink: 0,
              overflowY: "auto",
              background: "#f5f9fc",
              borderRight: "1px solid #dceaf2",
              padding: "8px 0",
            }}
          >
            <div
              style={{
                padding: "10px 18px 8px",
                color: "#8b9aa6",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
              }}
            >
              Subjects
            </div>

            {topicGroups.map(([topicId, topicVideos]) => {
              const topicName = topicVideos[0]?.topicName || `Topic ${topicId}`;

              const isSelected = String(selectedTopicId) === String(topicId);

              return (
                <button
                  key={topicId}
                  onClick={() => setSelectedTopicId(topicId)}
                  style={{
                    width: "calc(100% - 12px)",
                    margin: "2px 6px",
                    padding: "12px 12px",
                    border: "none",
                    borderRadius: "9px",
                    background: isSelected ? "#dff2fc" : "transparent",
                    color: isSelected ? "#168ac5" : "#526572",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                  onMouseEnter={(event) => {
                    if (!isSelected) {
                      event.currentTarget.style.background = "#eaf4f9";
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isSelected) {
                      event.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {/* Topic information */}
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: isSelected ? "700" : "500",
                      lineHeight: "1.4",
                      whiteSpace: "normal",
                      overflowWrap: "break-word",
                    }}
                  >
                    {topicName}
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "11px",
                      color: isSelected ? "#168ac5" : "#8b9aa6",
                    }}
                  >
                    {topicVideos.length} lectures
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div
                      style={{
                        width: "100%",
                        height: "3px",
                        marginTop: "9px",
                        borderRadius: "3px",
                        background: "#229ed9",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Videos */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: "auto",
              background: "#f7fbfe",
            }}
          >
            {/* Selected topic heading */}
            <div
              style={{
                padding: "18px 20px 12px",
                background: "#f7fbfe",
                color: "#526572",
                fontSize: "16px",
                fontWeight: "700",
                position: "sticky",
                top: 0,
                zIndex: 1,
                borderBottom: "1px solid #e5eef4",
              }}
            >
              {selectedTopicName}
            </div>

            {/* Videos */}
            {[...selectedTopicVideos]
              .sort((firstVideo, secondVideo) => firstVideo.id - secondVideo.id)
              .map((video, index) => (
                <button
                  key={video.id}
                  onClick={() => router.push(`/player?messageId=${video.id}`)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 18px",
                    border: "none",
                    borderBottom: "1px solid #e5eef4",
                    background: "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "#eef8ff";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "#ffffff";
                  }}
                >
                  {/* Lecture number */}
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      minWidth: "46px",
                      borderRadius: "50%",
                      background: "#dff2fc",
                      color: "#168ac5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      fontWeight: "700",
                    }}
                  >
                    {index + 1}
                  </div>

                  {/* Lecture info */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        color: "#202b33",
                        fontSize: "15px",
                        fontWeight: "500",
                        lineHeight: "1.4",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {video.name}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "#8b9aa6",
                        fontSize: "12px",
                      }}
                    >
                      Tap to play
                    </div>
                  </div>

                  {/* Play button */}
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      minWidth: "34px",
                      borderRadius: "50%",
                      background: "#229ed9",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                    }}
                  >
                    ▶
                  </div>
                </button>
              ))}

            {selectedTopicVideos.length === 0 && (
              <div
                style={{
                  padding: "50px 20px",
                  textAlign: "center",
                  color: "#8b9aa6",
                }}
              >
                No lectures found
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
