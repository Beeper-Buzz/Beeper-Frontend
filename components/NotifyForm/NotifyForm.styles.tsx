import styled from "@emotion/styled";

interface FormWrapperType {
  index: number;
}

interface GenericThemeType {
  theme?: any;
}

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 0 5px;
  position: relative;
`;

export const FormWrapper = styled.div<FormWrapperType>`
  margin: 40px 0 0 0;
  width: 340px;
  display: block;
  overflow: hidden;
  & form {
    transition: 0.33s all ease-in-out;
    width: auto;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow: hidden;
    justify-content: flex-start;
    margin-left: ${(p) => `-${340 * p.index}px`};
    @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
      margin-left: ${(p) => `-${92.5 * p.index}vw`};
      padding-right: 10vw;
      // padding-left: 10vw;
    }
  }
  @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
    width: 100vw;
  }
`;

interface QuestionWrapperType {
  isVisible?: boolean;
}

export const QuestionWrapper = styled.div<QuestionWrapperType>`
  display: ${(p) => (p.isVisible ? "block" : "none")};
  width: 340px;
  height: 125px;
  margin: 0 20px;
  @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
    width: 100vw;
  }
  &:first-child input {
    @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
      margin: 0 0 0 5vw;
    }
  }
`;

export const NotifyText = styled.div`
  text-align: center;
  width: 100%;
  font-style: normal;
  font-weight: 200;
  font-size: 14px;
  line-height: 19px;
  margin: 0 auto 20px auto;
`;

export const ErrorText = styled.div`
  text-align: center;
  width: 100%;
  font-style: normal;
  font-weight: 200;
  font-size: 14px;
  line-height: 19px;
  margin: -40px auto 20px auto;
  color: ${(p) => p.theme.colors.pink.primary};
`;

export const EmailInput = styled.input<GenericThemeType>`
  font-family: ${(p) => p.theme.typography.titleMD.fontFamily};
  font-size: ${(p) => p.theme.typography.titleMD.fontSize};
  font-weight: ${(p) => p.theme.typography.titleMD.fontWeight};
  line-height: ${(p) => p.theme.typography.titleMD.lineHeight};
  color: ${(p) => p.theme.typography.titleMD.color};
  text-align: left;
  width: 300px;
  height: 36.15px;
  background: ${(p) => p.theme.colors.purple.dark};
  border: 0px;
  box-sizing: border-box;
  box-shadow: -6px -6px 27px rgb(144 0 147 / 70%), 6px 6px 27px #000000,
    inset 1px 3px 30px #1a0300;
  border-radius: 36.1511px;
  position: relative;
  margin: 0;
  outline: none;
  padding: 8px 15px;
  color: ${(props) => props.theme.colors.blue.primary};
  &::placeholder {
    color: ${(props) => props.theme.colors.blue.primary};
  }
  &:focus::placeholder {
    color: ${(props) => props.theme.colors.pink.primary};
  }
  @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
    -webkit-appearance: none;
    width: 80vw;
    margin: 0 0 0 2.5vw;
  }
`;

export const Button = styled.button<GenericThemeType>`
  text-align: center;
  width: 121px;
  height: 36.15px;
  color: ${(p) => p.theme.colors.pink.light};
  background: ${(p) => p.theme.colors.pink.dark};
  font-family: ${(p) => p.theme.typography.titleSM.fontFamily};
  border: 2px solid rgba(255, 0, 138, 0.15);
  box-sizing: border-box;
  box-shadow: -6px -6px 12px rgb(144 0 147 / 11%),
    1px 1px 24px rgba(0, 0, 0, 0.33), inset 1px 2px 8px rgba(0, 0, 0, 0.5);
  border-radius: 36.1511px;
  position: relative;
  top: -36px;
  right: 0;
  cursor: pointer;
  float: right;
  font-size: 18px;
  letter-spacing: 1px;
  padding: 0;
  @media (max-width: ${(p) => p.theme.breakpoints.values.xs}px) {
    -webkit-appearance: none;
  }
`;

export const MailTo = styled.a`
  text-decoration: none;
  text-align: center;
  line-height: 19px;
  font-style: normal;
  font-weight: 200;
  margin-top: -20px;
`;
