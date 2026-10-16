import type { ReactNode, SVGProps } from "react";
import { cn } from "../lib/cn";

/** Hand-drawn 24x24 line icons: one stroke weight, currentColor, decorative by default. */
function icon(paths: ReactNode) {
  return function Icon({ className, ...rest }: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={cn("size-[1.25em] shrink-0", className)}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

export const EyeIcon = icon(
  <>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);
export const BellIcon = icon(
  <>
    <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </>,
);
export const BellOffIcon = icon(
  <>
    <path d="M6 16v-5a6 6 0 0 1 9-5.2M18 11v5l1.5 2H8" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
    <path d="M4 4l16 16" />
  </>,
);
export const SendIcon = icon(
  <>
    <path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" />
    <path d="M10 13l11-10" />
  </>,
);
export const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7" />);
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowLeftIcon = icon(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const ChevronDownIcon = icon(<path d="M6 9l6 6 6-6" />);
export const LayersIcon = icon(
  <>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 12.5l9 5 9-5" />
    <path d="M3 16.5l9 5 9-5" />
  </>,
);
export const HelpIcon = icon(
  <>
    <path d="M4 5h16v11H11l-4 4v-4H4V5z" />
    <path d="M10 9.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.5" />
    <path d="M12 14.6h.01" />
  </>,
);
export const IdCardIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.6-1.6 1.8-2.4 3-2.4s2.4.8 3 2.4" />
    <path d="M14.5 10h4M14.5 13h3" />
  </>,
);
export const GlobeIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" />
  </>,
);
export const MailIcon = icon(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 7l8.5 6.5L20.5 7" />
  </>,
);
export const ScalesIcon = icon(
  <>
    <path d="M12 4v16M7 20h10M5 8h14" />
    <path d="M5 8l-3 7a3.2 3.2 0 0 0 6 0L5 8z" />
    <path d="M19 8l-3 7a3.2 3.2 0 0 0 6 0l-3-7z" />
  </>,
);
export const LogoutIcon = icon(
  <>
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="M16 8l4 4-4 4" />
    <path d="M20 12H9" />
  </>,
);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </>,
);
export const SunIcon = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
  </>,
);
export const MoonIcon = icon(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />);
export const ContrastIcon = icon(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
  </>,
);
export const StarIcon = icon(<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />);
