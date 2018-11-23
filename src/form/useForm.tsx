import { useReducer } from "react";

type Fields<FIELDS> = { [P in keyof FIELDS]: string };

interface FormChangeAction {
  field: string;
  type: "valueChange";
  newValue: string;
}

interface FieldVisitAction {
  field: string;
  type: "fieldVisit";
}

type FormAction = FormChangeAction | FieldVisitAction;

type FieldsVisited<FIELDS> = { [P in keyof FIELDS]?: boolean };
type FormValues<FIELDS> = { [P in keyof FIELDS]: string };
type FormErrors<FIELDS> = { [P in keyof FIELDS]?: string[] | null };
type FormState<FIELDS> = {
  values: FormValues<FIELDS>;
  errors: { [P in keyof FIELDS]?: string[] | null };
  fieldsVisited: FieldsVisited<FIELDS>;
};

export type ValidateFn<FIELDS> = (
  newValues: Fields<FIELDS>,
  isVisited: (fieldName: keyof FIELDS) => boolean,
  recordError: (field: keyof FIELDS, msg: string) => void
) => void;

export function useForm<FIELDS>(
  validate: ValidateFn<FIELDS>,
  fields: Fields<FIELDS>
) {
  const formReducer: React.Reducer<FormState<FIELDS>, FormAction> = function(
    oldState,
    action
  ) {
    function errorRecorder(errors: FormErrors<FIELDS>) {
      return function(field: keyof FIELDS, msg: string) {
        if (!errors[field]) {
          errors[field] = [msg];
        } else {
          errors[field]!.push(msg);
        }
      };
    }

    switch (action.type) {
      case "valueChange": {
        const newValues = Object.assign({}, oldState.values, {
          [action.field]: action.newValue
        });
        const errors: FormErrors<FIELDS> = {};
        validate(
          newValues,
          fieldName => oldState.fieldsVisited[fieldName] === true,
          errorRecorder(errors)
        );

        return {
          ...oldState,
          errors,
          values: newValues
        };
      }

      case "fieldVisit": {
        const errors: FormErrors<FIELDS> = {};
        const fieldsVisited = {
          // https://stackoverflow.com/a/51193091/6134498
          ...(oldState.fieldsVisited as object),
          [action.field]: true
        } as FieldsVisited<FIELDS>;
        validate(
          oldState.values,
          (fieldName: keyof FIELDS) => fieldsVisited[fieldName] === true,
          errorRecorder(errors)
        );

        return {
          ...oldState,
          fieldsVisited,
          errors
        };
      }
    }

    return oldState;
  };

  const [currentState, dispatch] = useReducer<FormState<FIELDS>, FormAction>(
    formReducer,
    {
      values: fields,
      errors: {},
      fieldsVisited: {}
    }
  );

  function dispatchValueChange({
    currentTarget
  }: React.ChangeEvent<HTMLInputElement>) {
    dispatch({
      type: "valueChange",
      field: currentTarget.name,
      newValue: currentTarget.value
    });
  }

  function dispatchFieldVisit({
    currentTarget
  }: React.FocusEvent<HTMLInputElement>) {
    dispatch({
      type: "fieldVisit",
      field: currentTarget.name
    });
  }

  return [
    // "overall" form state
    {
      hasErrors: Object.keys(currentState.errors).length > 0,
      values: currentState.values
    },
    [
      // individual fields
      ...Array.from(Object.keys(fields)).map(fieldName => {
        return {
          // @ts-ignore
          value: currentState.values[fieldName],
          // @ts-ignore
          errorMessages: currentState.errors[fieldName],
          name: fieldName,
          onChange: dispatchValueChange,
          onBlur: dispatchFieldVisit
        };
      })
    ]
  ] as [OverallState, FormFieldInput[]];
}

type OverallState = { hasErrors: boolean; values: { [P: string]: string } };
type FormFieldInput = {
  value: any;
  errorMessages: any;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
};
