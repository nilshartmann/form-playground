import React, { useReducer } from "react";
import ErrorDisplay from './errorDisplay';

interface InputProps
  extends React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
  > {
  label: string;
  errorMessages?: string[];
  validating: boolean;
  visited: boolean;
  initialValue?: string;
}
/** We could use native input but for styling we use our own component */
export function Input({ label, errorMessages, validating, visited, initialValue, ...attrs }: InputProps) {
  return (
    <div className="FormGroup">
      <label>{label}
      <input type='text' defaultValue={initialValue} {...attrs} />
      </label>
      <ErrorDisplay visited={visited} errorMessages={errorMessages} />
      <div>{validating ? 'validating...' : ''}</div>
    </div>
  );
}
