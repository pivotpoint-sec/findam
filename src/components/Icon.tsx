// Small stroke icons. Decorative by default (aria-hidden); pass `label` to
// make an icon meaningful to screen readers.

const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  back: <path d="M15 6l-6 6 6 6" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z" />,
  phone: <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />,
  home: <path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" />,
  market: <path d="M3 9l2-5h14l2 5M3 9v11h18V9M3 9h18M9 20v-6h6v6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  flag: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  map: <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />,
  tools: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18h2" /></>,
  food: <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></>,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></>,
  car: <><path d="M5 17h14v-5l-2-5H7l-2 5z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></>,
  shirt: <path d="M8 3l4 2 4-2 5 4-3 3-2-1v12H8V9L6 10 3 7z" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  className,
  label,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {paths[name]}
    </svg>
  );
}

/** Filled green tick used for verified listings. */
export function VerifiedTick({ size = 18, label = "Verified" }: { size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="shrink-0"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <circle cx="12" cy="12" r="10" fill="#0B6B3A" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
