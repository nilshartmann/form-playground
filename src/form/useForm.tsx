import { useReducer, useState } from "react";
import { getValueFromObject, setValueOnObject } from './helpers';

type Fields<FIELDS> = { [P in keyof FIELDS]: any };
type Partial<T> = { [P in keyof T]: T[P] };

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
type FormErrors<FIELDS> = { [P in keyof FIELDS | string]?: string[] | null };
export type ValueCreators<FIELDS> = { [P in keyof FIELDS]?: () => object };

type FormState<FIELDS> = {
  values: FormValues<FIELDS>;
  errors: { [P in keyof FIELDS]?: string[] | null };
  fieldsVisited: FieldsVisited<FIELDS>;
};

export type ValidateFn<FIELDS> = (
  newValues: Partial<FIELDS>,
  isVisited: (fieldName: keyof FIELDS) => boolean,
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
): [OverallState<FIELDS>, FormFieldInput<any>[]] {
  let [values, setValues] = useState(fields);
  let [submitted, setSubmitted] = useState(false);
  let [fieldsVisited, setFieldsVisited] = useState({} as FieldsVisited<FIELDS>);
  let [errors, setErrors] = useState({} as FormErrors<FIELDS>);

  function errorRecorder(errors: FormErrors<FIELDS> | string, setErrors: (e: {}) => void) {
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
      /*      if (field instanceof String) {
              const currentErrors = getValueFromObject(fields as any, errors);
              
              if (!currentErrors) {
                setValueOnObject(fields as any, errors,[msg]);
              } else {
                currentErrors[field]!.push(msg);
              }
            } else {
              throw "Other index types than string are not supported yet. Check " + field + "'s type";
            }*/
    };
  }

  const doValidation = (newValues: Partial<FIELDS>, allFields: boolean = submitted) => {
    const newErrors: FormErrors<FIELDS> = {};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      errorRecorder(newErrors, (e) => setErrors(e))
    );
    console.log('newErrors ', newErrors);
    errors = newErrors;
    setErrors(errors);
    return newErrors;
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
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [currentTarget.name]: true
    } as FieldsVisited<FIELDS>;
    fieldsVisited = newFieldsVisited;
    doValidation(values);
    console.log('newieldsVisited ', newFieldsVisited);
    setFieldsVisited(newFieldsVisited);
  }

  function updateValues({ currentTarget }: React.ChangeEvent<HTMLInputElement>): void {
    setValue(currentTarget.name as keyof FIELDS, currentTarget.value);
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
  // ############################ Multi Field Operations
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
  // ############################# Sub-Object Operations
  // 

  function subEditorProps<T>(parentFieldName: any, value: T, idx: number): SubEditorProps<T> {
    const valueChanged = (e: any) => onMultiValueUpdate(parentFieldName, idx, { ...value as any, groesse: e.target.value });
    return {
      inputProps: function (name: keyof T): FormFieldInput<T> {
        return {
          errorMessages: errors[`${parentFieldName}[${idx}].${name}`],
          name: name as string,
          onBlur: valueChanged,
          onChange: valueChanged,
          value: (value as any)[name]

        }
      }
    }
  }

  // 
  // Construction of return value
  //
  function createIndividualFields(fieldName: [keyof FIELDS] | string) {
    const fieldKey = fieldName as keyof FIELDS;
    const isArray = fields[fieldKey] as any instanceof Array;
    const ret = {
      // @ts-ignore
      value: values[fieldName],
      // @ts-ignore
      errorMessages: errors[fieldName],
      name: fieldName,
      onChange: updateValues,
      onBlur: updateVisitedFields,
      foo: 'bar'
    };

    if (isArray) {
      console.log('multiEditor value ', values)
      const rv = ret as any;
      rv['onRemove'] = (idx: number) => onMultiFieldRemove(fieldKey, idx);
      rv['onAdd'] = () => onMultiAdd(fieldKey);
//      rv['onValueUpdate'] = (newValue: any, idx: number) => onMultiValueUpdate(fieldKey, idx, newValue);
      rv['subEditorProps'] = (newValue: any, idx: number) => subEditorProps(fieldName, newValue, idx, );

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
    [
      // individual fields
      ...Array.from(Object.keys(fields)).map(createIndividualFields)
    ]
  ] as [OverallState<FIELDS>, FormFieldInput<any>[]];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  values: Partial<FIELDS>;
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: () => void;
};
interface FormFieldInput<T> {
  value: T;
  errorMessages: any;
  name: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;

};
export interface MultiFormInput<T> extends FormFieldInput<T[]> {
  onValueUpdate: (pi: T, idx: number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  subEditorProps(value: any, idx: number): SubEditorProps<any>
}

export interface SubEditorProps<T> {
  inputProps: FormInputFieldPropsProducer<T>;

}

export type FormInputFieldPropsProducer<T> =
  (key: keyof T) => FormFieldInput<any>;

