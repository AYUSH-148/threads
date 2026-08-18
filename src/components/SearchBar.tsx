"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Spinner } from "./ui/spinner";

interface SearchProps {
  routeType: string;
  placeholder?: string;
}

const SearchBar = ({ routeType, placeholder }: SearchProps) => {
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Seeded from the URL so a shared or reloaded search page still shows the
  // term it is displaying results for.
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const initialTerm = useRef(search);

  useEffect(() => {
    // The original had no dependency array, so this effect re-ran on every
    // render — each one scheduling a fresh push and re-rendering again.
    if (search === initialTerm.current) return;

    const timer = setTimeout(() => {
      startTransition(() => {
        router.push(search ? `/${routeType}?q=${encodeURIComponent(search)}` : `/${routeType}`);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [search, routeType, router]);

  const clear = () => {
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="searchbar">
      <Search
        className="h-[18px] w-[18px] shrink-0 text-fg-subtle"
        strokeWidth={2.2}
      />

      <input
        ref={inputRef}
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={
          placeholder ??
          (routeType === "search" ? "Search creators" : "Search communities")
        }
        aria-label={placeholder ?? "Search"}
        className="w-full min-w-0 border-none bg-transparent text-base-regular text-fg outline-none placeholder:text-fg-subtle
                   [&::-webkit-search-cancel-button]:appearance-none"
      />

      {/* One slot, so the spinner replacing the clear button does not shift the
          field's contents sideways. */}
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isPending ? (
          <Spinner className="h-4 w-4 text-brand" label="Searching" />
        ) : (
          search && (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="text-fg-subtle transition-colors duration-200 hover:text-fg"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          )
        )}
      </span>
    </div>
  );
};

export default SearchBar;
