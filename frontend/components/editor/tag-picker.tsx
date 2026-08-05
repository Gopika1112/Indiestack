"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tagsAPI } from "@/lib/api";
import { X } from "lucide-react";

// TagPicker lets the author pick from existing tags (with usage counts) as well
// as create new free-text tags. Value is the array of selected tags.
export function TagPicker({
  value,
  onChange,
  max = 5,
  placeholder = "Add a topic...",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load existing tags once for suggestions.
  useEffect(() => {
    tagsAPI
      .list()
      .then((res) => setAllTags((res.data || []).map((t) => t.tag)))
      .catch(() => setAllTags([]));
  }, []);

  // Close the suggestion dropdown when clicking outside.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return allTags
      .filter((t) => !value.includes(t))
      .filter((t) => (q ? t.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [allTags, input, value]);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    if (value.includes(t)) {
      setInput("");
      return;
    }
    if (value.length >= max) return;
    onChange([...value, t]);
    setInput("");
    setOpen(true);
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 min-h-[40px] cursor-text"
        onClick={() => boxRef.current?.querySelector("input")?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {value.length < max && (
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-1"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1.5">
        {value.length}/{max} topics — pick from suggestions or type your own and press Enter.
      </p>
    </div>
  );
}
