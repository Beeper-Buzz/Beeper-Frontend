import styled from "@emotion/styled";

export const SocialContainer = styled.div`
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 95%;
  height: 104px;
  bottom: 0;
`;

export const SocialList = styled.ul`
  padding-inline-start: 0px;
`;
export const SocialListItem = styled.li`
  display: inline-block;
  margin: 0 10px;
  & a {
    color: ${(p) =>
      p.theme.isDarkMode
        ? p.theme.colors.white.primary
        : p.theme.colors.black.primary};
  }
  & a:hover {
    color: ${(p) => p.theme.colors.brand.primary};
  }
`;
export const SocialIcon = styled.img`
  height: 40px;
  width: 40px;
  padding: 5px;
`;
