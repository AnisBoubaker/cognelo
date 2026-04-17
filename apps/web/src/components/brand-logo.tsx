"use client";

import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  priority?: boolean;
  size?: "header" | "hero";
};

export function BrandLogo({ href, priority = false, size = "header" }: BrandLogoProps) {
  const content = (
    <span className={`brand-logo brand-logo-${size}`}>
      <Image
        alt="Cognara"
        className="brand-logo-image"
        height={size === "hero" ? 620 : 620}
        priority={priority}
        src="/brand/cognara-logo-tight.png"
        width={size === "hero" ? 1100 : 1100}
      />
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link aria-label="Cognara" className="brand-link" href={href}>
      {content}
    </Link>
  );
}
