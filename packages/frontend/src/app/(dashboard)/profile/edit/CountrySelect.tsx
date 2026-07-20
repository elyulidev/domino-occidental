"use client";

import { useEffect, useRef, useState } from "react";
import { COUNTRY_OPTIONS, getCountryName, getFlagEmoji } from "@/lib/countries";

type CountrySelectProps = {
  defaultValue: string | null;
  name: string;
};

export function CountrySelect({ defaultValue, name }: CountrySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = search
    ? COUNTRY_OPTIONS.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRY_OPTIONS;

  const selectedName = selected ? getCountryName(selected) : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(code: string) {
    setSelected(code);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={selected} />

      {/* Trigger button */}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={selected ? `País: ${selectedName}` : "Seleccionar país"}
        onClick={() => {
          setIsOpen(!isOpen);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex w-full items-center gap-3 rounded-lg border border-domino-700 bg-domino-800/50 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-gold-500/50"
      >
        {selected ? (
          <>
            <span className="text-lg leading-none">{getFlagEmoji(selected)}</span>
            <span>{selectedName}</span>
            <span className="ml-auto text-xs text-domino-500">{selected}</span>
          </>
        ) : (
          <span className="text-domino-400">Seleccionar país</span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`ml-auto h-4 w-4 text-domino-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          role="img"
          aria-label={isOpen ? "Cerrar" : "Abrir"}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <ul
          ref={listRef}
          aria-label="Países"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-domino-700 bg-domino-900 shadow-2xl shadow-black/40"
        >
          {/* Search input */}
          <li className="sticky top-0 border-b border-domino-700 bg-domino-900 p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar país..."
              className="w-full rounded-lg border border-domino-700 bg-domino-800/50 px-3 py-2 text-sm text-white placeholder-domino-500 outline-none focus:border-gold-500/50"
            />
          </li>

          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-domino-500">
              No se encontraron países
            </li>
          ) : (
            filtered.map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected === country.code}
                  onClick={() => handleSelect(country.code)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-domino-700/60 ${
                    selected === country.code
                      ? "bg-gold-500/10 text-gold-400"
                      : "text-white"
                  }`}
                >
                  <span className="text-lg leading-none">
                    {getFlagEmoji(country.code)}
                  </span>
                  <span>{country.name}</span>
                  <span className="ml-auto text-xs text-domino-500">
                    {country.code}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
