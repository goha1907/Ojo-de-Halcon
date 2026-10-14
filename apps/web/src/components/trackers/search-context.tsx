"use client";

import { createContext, useContext } from "react";

/** The search words typed above a list of trackings: cards open to show where they matched. */
const SearchWordsContext = createContext<string[]>([]);

export const SearchWordsProvider = SearchWordsContext.Provider;

export function useSearchWords(): string[] {
  return useContext(SearchWordsContext);
}
