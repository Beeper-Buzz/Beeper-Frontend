export * from "./SearchSuggestions";
export interface SearchSuggestionsProps {
  id?: string;
  labelId?: string;
  isVisible?: boolean;
  setIsSearchLoading: (e: boolean) => void;
  toggleVisibility: (e: boolean) => void;
  onSelect: (e: string) => void;
  query?: string;
}

export interface AutoCompleteProps {
  id?: string;
  labelId?: string;
  isVisible?: boolean;
  setIsSearchLoading: (e: boolean) => void;
  toggleVisibility: (e: boolean) => void;
  onSelect: (e: string) => void;
  query?: string;
}
