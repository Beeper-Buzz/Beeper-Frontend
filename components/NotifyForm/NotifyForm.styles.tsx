import styled from "@emotion/styled";

//Emotion styling
export const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 95%;
  height: 175px;
`;

export const NotifyText = styled.div`
  text-align: center;
  width: 100%;
  font-style: normal;
  font-weight: 200;
  font-size: 15px;
  line-height: 19px;
  color: ${(props) => props.theme.colors.black.primary};
`;

interface FormWrapperType {
  index: number;
}

export const FormWrapper = styled.div<FormWrapperType>`
  margin: 10px auto;
  width: 300px;
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
    margin-left: ${(p) => `-${300 * p.index}px`};
  }
`;

interface QuestionWrapperType {
  isVisible?: boolean;
}

export const QuestionWrapper = styled.div<QuestionWrapperType>`
  display: ${(p) => (p.isVisible ? "block" : "none")};
  width: 300px;
`;

export const EmailInput = styled.input`
  text-align: left;
  width: 300px;
  height: 36.15px;
  border: none;
  box-sizing: border-box;
  // position: absolute;
  // left: 50%;
  // margin-left: -150px;
  outline: none;
  padding: 8px 15px;
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23333' stroke-width='4' stroke-dasharray='11%2c 33%2c 66%2c 10' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e");
  transition: 0.33s all ease-in-out;
  &::placeholder {
    color: ${(props) => props.theme.colors.black.primary};
  }
  &:focus {
    transition: 0.33s all ease-in-out;
    color: ${(props) => props.theme.colors.blue.primary};
    background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' stroke='%23333' stroke-width='4' stroke-dasharray='0' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e");
  }
  &:focus::placeholder {
    color: ${(props) => props.theme.colors.blue.primary};
  }
`;

export const Button = styled.button`
  padding: 0;
  margin: 0;
  transition: 0.33s all ease-in-out;
  color: #000;
  text-align: center;
  width: 201px;
  height: 36.15px;
  margin-left: -100px;
  opacity: 0.66;
  background: rgb(154, 154, 154);
  background: linear-gradient(90deg, rgba(154, 154, 154, 0) 0%, rgba(154, 154, 154, 1) 100%);
  border: none;
  box-sizing: border-box;
  position: relative;
  top: 0;
  right: 0;
  width: 75px;
  cursor: pointer;
  float: right;
  font-size: 15px;
  &:hover {
    transition: 0.33s all ease-in-out;
    opacity: 1;
  }
  &:active {
    background: ${(props) => props.theme.colors.black.primary};
    color: ${(props) => props.theme.colors.white.primary};
  }
`;

export const MailTo = styled.a`
  text-decoration: none;
  text-align: center;
  line-height: 19px;
  font-style: normal;
  font-weight: 200;
  color: #000;
  padding-top: 25px;
  bottom: 0;
`;
