import {  useState } from "react";

function errorRecorder<FIELDS>(errors: FormErrors<FIELDS> | string) {
  return function (field: keyof FIELDS | string, msg: string) {
    //TODO Why is that:
    //[ts] Type 'string | keyof FIELDS' cannot be used to index type 'string | FormErrors<FIELDS>'. [2536]
    // (parameter) errors: string | FormErrors<FIELDS>
    // @ts-ignore
    if (!errors[field]) {
      // @ts-ignore
      errors[field] = [msg];
    } else {
      // @ts-ignore
      errors[field]!.push(msg);
    }
  };
}


type Fields<FIELDS> = { [P in keyof FIELDS]: any };
type Partial<T> = { [P in keyof T]: T[P] };

type FieldsVisited<FIELDS> = { [P in keyof FIELDS | string]?: boolean };
type FormErrors<FIELDS> = { [P in keyof FIELDS | string]?: string[] | null };
export type ValueCreators<FIELDS> = { [P in keyof FIELDS]?: () => object };

export type ValidateFn<FIELDS> = (
  newValues: Partial<FIELDS>,
  isVisited: (fieldName: keyof FIELDS | string) => boolean,
  recordError: (field: keyof FIELDS | string, msg: string) => void
) => void;

//
// useFormHook ########################################################################
//

export function useForm<FIELDS>(
  validate: ValidateFn<FIELDS>,
  fields: Fields<FIELDS>,
  submit: () => void,
  valueCreators: ValueCreators<FIELDS> = {}
): [OverallState<FIELDS>, FormInputFieldPropsProducer<any>] {
  let [values, setValues] = useState(fields);
  let [submitted, setSubmitted] = useState(false);
  let [fieldsVisited, setFieldsVisited] = useState({} as FieldsVisited<FIELDS>);
  let [errors, setErrors] = useState({} as FormErrors<FIELDS>);

  //
  // validation ##############################################################
  // 
  const doValidation = (newValues: Partial<FIELDS>, allFields: boolean = submitted) => {
    const newErrors: FormErrors<FIELDS> = {};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      errorRecorder(newErrors)
    );
    console.log('newErrors ', newErrors);
    errors = newErrors;
    setErrors(errors);
    return newErrors;
  }

  //
  // update values etc. ##############################################################
  // 

  function updateValues({ currentTarget }: React.ChangeEvent<HTMLInputElement>): void {
    setValue(currentTarget.name as keyof FIELDS, currentTarget.value);
  }

  const setValue = (field: keyof FIELDS, newValue: any) => {
    const newValues = Object.assign({}, values, {
      [field]: newValue
    });
    doValidation(newValues);
    values = newValues;
    setValues(values);
    console.log(`setting value for ${field} to `, newValue);
  }

  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>): void {
    setFieldVisited(currentTarget.name);
  }

  function setFieldVisited(fieldName:string) {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [fieldName]: true
    } as FieldsVisited<FIELDS>;
    fieldsVisited = newFieldsVisited;
    doValidation(values);
    console.log('newieldsVisited ', newFieldsVisited);
    setFieldsVisited(newFieldsVisited);

  }

  function handleSubmit() {
    setSubmitted(true);
    const newErrors = doValidation(values, true);
    if (Object.keys(newErrors).length === 0) {
      submit();
    } else {
      console.log('Errors found, submit aborted.');
    }

  }

  //
  // ############################################################ Multi Field Operations
  //


  const onMultiFieldRemove = (field: keyof FIELDS, idx: number) => {
    let newArray = (values[field] as []).filter((e, myIdx) => idx !== myIdx);
    setValue(field, newArray);
  }
  //onMultiFieldChange: (pi: Pizza, idx: number) => void;
  const onMultiAdd = (field: keyof FIELDS) => {
    const initial: any[] = values[field] as any[];
    const valueCreator: (() => object) | undefined = valueCreators[field];
    if (valueCreator) {
      const newArray = [...(initial)];
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
    const newArray = (values[field] as any[]);
    newArray[idx] = newValue;
    setValue(field, newArray);
  }

  //
  // ############################################################## Sub-Object Operations
  // 

  function subEditorProps<T>(parentFieldName: any, value: T, idx: number): SubEditorProps<T> {
    return {
      inputProps: function (childFieldName: keyof T): FormFieldInput {
        const valueChanged = (e: any) => {
          const newValue = { ...value as any };
          newValue[childFieldName as any] = e.target.value;
          onMultiValueUpdate(parentFieldName, idx, newValue);
        };
        const fieldPath = `${parentFieldName}[${idx}].${childFieldName}`;
        return {
          errorMessages: errors[fieldPath],
          name: childFieldName as string,
          onBlur: () => setFieldVisited(fieldPath),
          onChange: valueChanged,
          value: (value as any)[childFieldName]
        }
      }
    }
  }

  // 
  // Construction of return value
  //

 // Der FormInputFieldProducer könnte auch noch minimalkonfiguration nehmen, z.B. Multi oder nicht, bzw. HTMLInputField oder eigenes.

 // komplett auf Pfade umstellen sodass es keinen unterschied mehr macht aus welcher tiefe man setValue aufruft.

  function createIndividualFields<T>(fieldName: [keyof FIELDS] | string): FormFieldInput {
    const fieldKey = fieldName as keyof FIELDS;
    const isArray = fields[fieldKey] as any instanceof Array;
    const ret: FormFieldInput = {
      // @ts-ignore
      value: values[fieldName],
      // @ts-ignore
      errorMessages: errors[fieldName],
      name: fieldName as string,
      onChange: updateValues,
      onBlur: updateVisitedFields
    };

    if (isArray) {
      console.log('multiEditor value ', values)
      const rv = ret as any;
      rv['onRemove'] = (idx: number) => onMultiFieldRemove(fieldKey, idx);
      rv['onAdd'] = () => onMultiAdd(fieldKey);
      rv['subEditorProps'] = (newValue: any, idx: number) => subEditorProps(fieldName, newValue, idx);

    }
    return ret;

  }

  return [
    // "overall" form state
    {
      hasErrors: Object.keys(errors).length > 0,
      values: values,
      setValue: setValue,
      handleSubmit: handleSubmit

    },
    createIndividualFields
  ] as [OverallState<FIELDS>, FormInputFieldPropsProducer<any>];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  values: Partial<FIELDS>;
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: () => void;
};
interface FormFieldInput {
  value: any;
  errorMessages: any;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;

};
export interface MultiFormInput<T> extends FormFieldInput {
  onValueUpdate: (pi: T, idx: number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  subEditorProps(value: any, idx: number): SubEditorProps<any>
}

export interface SubEditorProps<T> {
  inputProps: FormInputFieldPropsProducer<T>;

}

export type FormInputFieldPropsProducer<T> =
  (key: keyof T) => FormFieldInput;

