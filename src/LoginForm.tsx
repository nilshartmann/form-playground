import React from "react";
// UI (independent from useForm hook)
import { Input } from "./form/Input";

// Form Logic
import { ValidateFn, useForm } from "./form/useForm";

interface LoginFormState {
  username: string;
  password: string;
}

const validateLoginForm: ValidateFn<LoginFormState> = function(
  newFormInput,
  isVisited,
  recordError
) {
  if (isVisited("username") && newFormInput.username.length < 1) {
    recordError("username", "Please enter your username");
  }

  if (isVisited("password") && newFormInput.password.length < 1) {
    recordError("password", "Please enter your password");
  }
};

export default function LoginForm() {
  const [overallFormState, [usernameInput, passwordInput]] = useForm<
    LoginFormState
  >(validateLoginForm, {
    username: "",
    password: ""
  });

  function submit() {
    console.log("login with", overallFormState.values);
  }

  return (
    <div className="Form">
      <Input label="Username" {...usernameInput} />
      <Input label="Password" type="password" {...passwordInput} />
      <button disabled={overallFormState.hasErrors} onClick={submit}>
        Login!
      </button>
    </div>
  );
}
