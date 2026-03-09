"use client";

export default function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CREDASYS logo"
      role="img"
    >
      <defs>
        <linearGradient id="credasys-g" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-strong)" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#credasys-g)" />
      <path
        d="M17 26.5C17 20.7 21.7 16 27.5 16H37.5V21H28.5C24.9 21 22 23.9 22 27.5V36.5C22 40.1 24.9 43 28.5 43H37.5V48H27.5C21.7 48 17 43.3 17 37.5V26.5Z"
        fill="white"
        fillOpacity="0.92"
      />
      <rect x="33.5" y="23" width="4" height="18" rx="2" fill="white" fillOpacity="0.92" />
      <rect x="40.5" y="19" width="4" height="22" rx="2" fill="white" fillOpacity="0.92" />
      <rect x="47.5" y="27" width="4" height="14" rx="2" fill="white" fillOpacity="0.92" />
    </svg>
  );
}

