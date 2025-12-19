import React, { useContext, useEffect, useState } from "react";
import { useQuery } from "react-query";
import { LoadingIcon } from "..";
import { useProducts } from "../../hooks/useProducts";
import { StyledAutoComplete } from "./SearchSuggestions.styles";
import Suggestion from "./Suggestion";
import { AutoCompleteProps } from "./types";

const AutoComplete = ({
  id,
  labelId,
  isVisible,
  toggleVisibility,
  onSelect,
  query
}: AutoCompleteProps) => {
  const {
    error,
    status,
    data,
    isLoading,
    isSuccess
  }: {
    error: any;
    status: any;
    data: any;
    isLoading: boolean;
    isSuccess: boolean;
  } = useProducts(1);
  const [page, setPage] = useState(1);
  const [suggestions, setSuggestions] = useState([]);
  // const [error, setError] = useState('');

  useEffect(() => {
    // getSearchData();
    // data ? console.log("stuff: ", data) : null;
    console.log("suggestions: ", suggestions);
  }, [suggestions]);

  if (!isVisible) return null;

  if (isLoading) {
    return (
      <StyledAutoComplete role="listbox" aria-labelledby={labelId} id={id}>
        <LoadingIcon className="bts bt-spinner bt-pulse" />
      </StyledAutoComplete>
    );
  }

  if (error) {
    return (
      <StyledAutoComplete role="listbox" aria-labelledby={labelId} id={id}>
        <p>Error {status}</p>
      </StyledAutoComplete>
    );
  }

  if (!data || data.data.length === 0) return null;

  return (
    <StyledAutoComplete role="listbox" aria-labelledby={labelId} id={id}>
      {isVisible &&
        data?.data?.map((item, index) => {
          return (
            <Suggestion
              suggestion={item}
              key={`${item.id}-${index}`}
              toggleVisibility={(e: any) => toggleVisibility(e)}
              onChange={(e: any) => onSelect(e)}
              query={query}
            />
          );
        })}
    </StyledAutoComplete>
  );
};

export default AutoComplete;
