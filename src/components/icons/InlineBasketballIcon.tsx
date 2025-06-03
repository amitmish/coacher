// src/components/icons/InlineBasketballIcon.tsx
import type { SVGProps } from 'react';

export function InlineBasketballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M7 12a13.2 13.2 0 0 0 10 0" />
      <path d="M12 7a13.2 13.2 0 0 0 0 10" />
      <path d="M18.36 18.36a10 10 0 0 0-12.72 0" />
      <path d="M18.36 5.64a10 10 0 0 0-12.72 0" />
    </svg>
  );
}
