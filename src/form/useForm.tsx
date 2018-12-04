import { useReducer, useState } from "react";

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
  fields: Fields<FIELDS>,
  submit: () => void
) {
  function errorRecorder(errors: FormErrors<FIELDS>, setErrors:(e:{})=>void) {
    return function(field: keyof FIELDS, msg: string) {
      if (!errors[field]) {
        errors[field] = [msg];
      } else {
        errors[field]!.push(msg);
      }
      setErrors(errors);
    };
  }

  const [values, setValues] = useState(fields);
  const [fieldsVisited, setFieldsVisited] = useState({} as FieldsVisited<FIELDS>);
  const [errors, setErrors] = useState({} as FormErrors<FIELDS>);

  const doValidation = (newValues: FormValues<FIELDS>, allFields?:boolean) => {
    const newErrors:FormErrors<FIELDS>={};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      errorRecorder(newErrors,(e) => setErrors(e))
    );
    return newErrors;
  }

  const updateValues = (field: keyof FIELDS, newValue:any) => {
    const newValues = Object.assign({}, values, {
      [field]: newValue
    });
    doValidation(newValues);
    setValues(newValues);
  }
  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>):void {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [currentTarget.name]: true
    } as FieldsVisited<FIELDS>;
    doValidation(values);
    setFieldsVisited(newFieldsVisited);
  }
  function onUpdateValues ({ currentTarget }: React.ChangeEvent<HTMLInputElement>):void  {
    updateValues(currentTarget.name as keyof FIELDS, currentTarget.value);
  }  

  function handleSubmit() {
    const newErrors=doValidation(values, true);
    if(Object.keys(newErrors).length === 0) {
      submit();
    } else {
      console.log('Errors found, submit aborted.');
    }

  }

 

  return [
    // "overall" form state
    {
      hasErrors: Object.keys(errors).length > 0,
      values: values,
      setValue: updateValues,
        handleSubmit: handleSubmit

    },
    [
      // individual fields
      ...Array.from(Object.keys(fields)).map(fieldName => {
        return {
          // @ts-ignore
          value: values[fieldName],
          // @ts-ignore
          errorMessages: errors[fieldName],
          name: fieldName,
          onChange: onUpdateValues,
          onBlur: updateVisitedFields
        };
      })
    ]
  ] as [OverallState<FIELDS>, FormFieldInput[]];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  values: { [P: string]: string };
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: () => void;
};
type FormFieldInput = {
  value: any;
  errorMessages: any;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
};
