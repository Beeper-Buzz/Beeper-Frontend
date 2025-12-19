<<<<<<<< HEAD:components/SearchSuggestions/types/index.d.ts
export * from "./SearchSuggestions";
export interface SearchSuggestionsProps {
  id?: string;
  labelId?: string;
  isVisible?: boolean;
  setIsSearchLoading: (e) => void;
========
export interface AutoCompleteProps {
  id?: string;
  labelId?: string;
  isVisible?: boolean;
>>>>>>>> 02806cf2e332e0d05189f6600158d4b840241643:components/AutoComplete/types/index.d.ts
  toggleVisibility: (e) => void;
  onSelect: (e) => void;
  query?: string;
}
