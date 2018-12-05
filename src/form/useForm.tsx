import { useReducer, useState } from "react";

type Fields<FIELDS> = { [P in keyof FIELDS]: any };

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
export type ValueCreators<FIELDS> = { [P in keyof FIELDS]?: () => object };
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
  submit: () => void,
  valueCreators: ValueCreators<FIELDS> = {}
) {
  const [values, setValues] = useState(fields);
  const [submitted, setSubmitted] = useState(false);
  const [fieldsVisited, setFieldsVisited] = useState({} as FieldsVisited<FIELDS>);
  const [errors, setErrors] = useState({} as FormErrors<FIELDS>);

  function errorRecorder(errors: FormErrors<FIELDS>, setErrors:(e:{})=>void) {
    return function(field: keyof FIELDS, msg: string) {
      if (!errors[field]) {
        errors[field] = [msg];
      } else {
        errors[field]!.push(msg);
      }
      
    };
  }

  const doValidation = (newValues: FormValues<FIELDS>, allFields:boolean=submitted) => {
    const newErrors:FormErrors<FIELDS>={};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      errorRecorder(newErrors,(e) => setErrors(e))
    );
    console.log('newErrors ', newErrors);
    setErrors(newErrors);
    return newErrors;
  }

  const setValue = (field: keyof FIELDS, newValue:any) => {
    const newValues = Object.assign({}, values, {
      [field]: newValue
    });
    doValidation(newValues);
    setValues(newValues);
    console.log(`setting value for ${field} to `, newValue);
  }

  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>):void {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [currentTarget.name]: true
    } as FieldsVisited<FIELDS>;
    doValidation(values);
    console.log('newieldsVisited ', newFieldsVisited);
    setFieldsVisited(newFieldsVisited);
  }

  function updateValues ({ currentTarget }: React.ChangeEvent<HTMLInputElement>):void  {
    setValue(currentTarget.name as keyof FIELDS, currentTarget.value);
  }  

  function handleSubmit() {
    setSubmitted(true);
    const newErrors=doValidation(values, true);
    if(Object.keys(newErrors).length === 0) {
      submit();
    } else {
      console.log('Errors found, submit aborted.');
    }

  }

  //
  // ############################ Multi Field Operations
  //

  const onMultiFieldRemove = (field: keyof FIELDS, idx: number) => {
    let newArray=(values[field] as []).filter((e,myIdx) => idx !== myIdx);
    setValue(field, newArray);
  }
  //onMultiFieldChange: (pi: Pizza, idx: number) => void;
  const onMultiAdd = (field: keyof FIELDS) => {
    const initial:any[] = values[field] as any[];
    const valueCreator: (() => object) | undefined = valueCreators[field];
    if (valueCreator) {
      const newArray=[...(initial)];
      newArray.push(valueCreator());
      setValue(field, newArray);
    } else {
      console.error(`No valueCreator for ${field} was supplied. 
      Adding values is impossible. To change this supply 
      an object with a valueCreator for ${field} to useForm`);
    }
  }
  const onMultiValueUpdate = (field: keyof FIELDS, idx: number, newValue: any) => {
    console.log('new value ', newValue);
    const newArray=(values[field] as any[]);
    newArray[idx] = newValue;
    setValue(field, newArray);
  }


 

  return [
    // "overall" form state
    {
      hasErrors: Object.keys(errors).length > 0,
      values: values,
      setValue: setValue,
        handleSubmit: handleSubmit

    },
    [
      // individual fields
      ...Array.from(Object.keys(fields)).map(fieldName => {
        const fieldKey = fieldName as keyof FIELDS;
        return {
          // @ts-ignore
          value: values[fieldName],
          // @ts-ignore
          errorMessages: errors[fieldName],
          name: fieldName,
          onChange: updateValues,
          onBlur: updateVisitedFields,
          foo: 'bar',
          onRemove: (idx: number) => onMultiFieldRemove(fieldKey, idx),
          onAdd: () => onMultiAdd(fieldKey),
          onValueUpdate: ( newValue: any, idx: number) => onMultiValueUpdate(fieldKey, idx, newValue)
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
  onValueUpdate: (pi: any, idx: number) => void;
  onRemove: (idx:number) => void;
  onAdd: () => void;

};
export interface MultiEditorProps<T> {
  value: T[];
  onRemove: (idx: number) => void;
  onValueUpdate: (pi: T, idx: number) => void;
  onAdd: () => void;
}

