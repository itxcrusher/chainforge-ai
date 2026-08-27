"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type PageHeaderLink = {
  href: string;
  label: string;
  external?: boolean;
};

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  links?: PageHeaderLink[];
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  links,
  meta,
  className = "mb-8",
}: PageHeaderProps) {
  return (
    <header className={className}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 4L6 8l4 4" />
          </svg>
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-[0.18em] mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {title}
          </h1>
          {description && (
            <div className="mt-3 max-w-2xl text-sm sm:text-base text-slate-400 leading-relaxed">
              {description}
            </div>
          )}
          {links && links.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              {links.map((link, index) => (
                <span key={link.href} className="inline-flex items-center gap-3">
                  {index > 0 && <span className="text-slate-700">·</span>}
                  {link.external ? (
                    <a href={link.href} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                      {link.label}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {(actions || meta) && (
          <div className="w-full md:w-auto md:max-w-sm md:shrink-0">
            {actions ?? meta}
          </div>
        )}
      </div>
    </header>
  );
}
