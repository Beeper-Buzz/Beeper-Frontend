export * from "./SearchSuggestions";
export interface SearchSuggestionsProps {
  id?: string;
  labelId?: string;
  isVisible?: boolean;
  setIsSearchLoading: () => void;
  toggleVisibility: (e) => void;
  onSelect: (e) => void;
  query?: string;
}
