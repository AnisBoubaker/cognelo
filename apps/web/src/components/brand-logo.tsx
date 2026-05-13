"use client";

import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  priority?: boolean;
  size?: "header" | "hero";
};

export function BrandLogo({ href, priority = false, size = "header" }: BrandLogoProps) {
  const image = size === "header"
    ? { src: "/brand/cognelo-logo-horiz.png", width: 1000, height: 340 }
    : { src: "/brand/cognelo-logo-tight.png", width: 1100, height: 620 };
  const content = (
    <span className={`brand-logo brand-logo-${size}`}>
      <Image
        alt="Cognelo"
        className="brand-logo-image"
        height={image.height}
        priority={priority}
        src={image.src}
        width={image.width}
      />
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link aria-label="Cognelo" className="brand-link" href={href}>
      {content}
    </Link>
  );
}
