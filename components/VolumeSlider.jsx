"use client";

export default function VolumeSlider({ value, onChange }) {
  return (
    <div className="volume-slider flex items-center overflow-hidden">
      <input
        className="w-0 opacity-0 group-hover:w-[52px] group-hover:opacity-100 transition-all duration-200"
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => {
          onChange(Number(event.target.value));
        }}
        style={{
          "--volume-progress": `${value}%`,
        }}
        aria-label="Volume"
      />
    </div>
  );
}
