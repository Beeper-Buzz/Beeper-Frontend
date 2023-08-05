import styled from "@emotion/styled";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";

export const StyledList = styled(List)`
  outline: none;
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
`;

export const StyledListItem = styled(ListItem)`
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
`;

export const StyledListItemText = styled(ListItemText)``;

export const StyledListItemIcon = styled(ListItemIcon)``;

export const MenuFooter = styled.div`
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
  color: ${(p) => p.theme.colors.gray.light} !important;
  bottom: 0;

  & a {
    color: ${(p) => p.theme.colors.gray.medium} !important;
  }
`;