import { useState } from "react";
import {setValueOnObject,getValueFromObject} from './helpers'


//
// Validation Helpers ###########################################################
//
function createErrorRecorder<FIELDS>(errors: FormErrors<FIELDS>) {
  return function (field: keyof FIELDS | string, msg: string, exclusive: boolean = false) {
    //TODO Why is that:
    //[ts] Type 'string | keyof FIELDS' cannot be used to index type 'string | FormErrors<FIELDS>'. [2536]
    // (parameter) errors: string | FormErrors<FIELDS>
    // @ts-ignore
    if (!errors[field] || exclusive) {
      // @ts-ignore
      errors[field] = [msg];
    } else {
      // @ts-ignore
      errors[field]!.push(msg);
    }
  };
}
function createValidateDelayed<FIELDS>(newErrors: FormErrors<FIELDS>, setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>,
  validate: ValidateFn<FIELDS>
): ValidateDelayed<FIELDS> {
  const validateDelayed: ValidateDelayed<FIELDS> = function (field: keyof FIELDS | string, promise: Promise<DelayedValidatorFunction<FIELDS>>) {
    newErrors[field] = undefined;
    function updateState(newState: State<FIELDS>, dvf: DelayedValidatorFunction<FIELDS>): State<FIELDS> {
      const newErrors: FormErrors<FIELDS> = {} as FormErrors<FIELDS>;
      const errorRecorder = createErrorRecorder(newErrors);
      // first validate the on async field
      dvf(newState.values, errorRecorder);
      // then validate anything else...
      validate(newState.values,
        fieldName => (newState.fieldsVisited[fieldName] === true),
        errorRecorder,
        // ...omitting anything that should be validated delayed
        DontValidateAnythingDelayed
      );
      return { ...newState, errors: newErrors }
    }
    // etState: 
    promise.then((dvf: DelayedValidatorFunction<FIELDS>) => setState((newState) => updateState(newState, dvf)));
  }
  return validateDelayed;

}
const DontValidateAnythingDelayed: ValidateDelayed<any> = (f, p) => { };


type Fields<FIELDS> = { [P in keyof FIELDS]: any };
type Partial<T> = { [P in keyof T]: T[P] };

type FieldsVisited<FIELDS> = { [P in keyof FIELDS | string]?: boolean };
type FormErrors<FIELDS> = { [P in keyof FIELDS | string]?: string[] | null };
type DoValidation<FIELDS> = (newValues: Partial<FIELDS>, allFields?: boolean, initialErros?: FormErrors<FIELDS>) => FormErrors<FIELDS>;

type Path = string;

export type ValueCreators<FIELDS> = { [P in keyof FIELDS]?: () => object };
export type RecordError<FIELDS> =
  (field: keyof FIELDS | string, msg: string, exclusive?: boolean) => void;
export type ClearErrors<FIELDS> =
  (field: keyof FIELDS | string, msg: string) => void;
/**
 * A funtion that is called to indicate a delayed validation has happend.
 */
export type DelayedValidatorFunction<FIELDS> = (currentValue: FIELDS, errorRecorder: RecordError<FIELDS>) => void;
export type ValidateDelayed<FIELDS> = ((field: keyof FIELDS | string, promise: Promise<DelayedValidatorFunction<FIELDS>>) => void);

export type ValidateFn<FIELDS> = (
  newValues: Partial<FIELDS>,
  isVisited: (fieldName: keyof FIELDS | string) => boolean,
  recordError: RecordError<FIELDS>,
  validateDelayed: ValidateDelayed<FIELDS>
) => void;
//
// useFormHook ########################################################################
//

interface State<FIELDS> {
  values: Fields<FIELDS>;
  submitted: boolean;
  fieldsVisited: FieldsVisited<FIELDS>;
  errors: FormErrors<FIELDS>
}

function setStateSave<FIELDS>( field: keyof State<FIELDS>, value: any): (x:State<FIELDS>) => State<FIELDS> {
  return (s: State<FIELDS>) => {
    s[field] = value;
    return s;
  }
}

export function useForm<FIELDS>(
  validate: ValidateFn<FIELDS>,
  fields: Fields<FIELDS>,
  submit: () => void,
  valueCreators: ValueCreators<FIELDS> = {}
): [OverallState<FIELDS>, FormInputFieldPropsProducer<any>] {
  const [state, setState] = useState({ values: fields, submitted: false, fieldsVisited: {}, errors: {} } as State<FIELDS>);;
  let { values, submitted, fieldsVisited, errors } = state;
  const setValues = (v: Fields<FIELDS>) => setState(setStateSave('values', v));
  const setSubmitted = (v: boolean) => setState(setStateSave('submitted', v));
  const setFieldsVisited = (v: FieldsVisited<FIELDS>) => setState(setStateSave('fieldsVisited', v));
  const setErrors = (v: FormErrors<FIELDS>) => setState(setStateSave('errors', v ));
  //
  // validation ##############################################################
  // 
  const doValidation: DoValidation<FIELDS> = (newValues: Partial<FIELDS>, allFields: boolean = submitted) => {
    const newErrors: FormErrors<FIELDS> = {};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      createErrorRecorder(newErrors),
      createValidateDelayed(newErrors, setState, validate)
    );
    setErrors(newErrors);
    return newErrors;
  }

  //
  // update values etc. ##############################################################
  // 

  function updateValues({ currentTarget }: React.ChangeEvent<HTMLInputElement>): void {
    setValue(currentTarget.name as keyof FIELDS, currentTarget.value);
  }

  const setValue = (path: Path | keyof FIELDS, newValue: any) => {
    console.log(`setting value for ${path} to `, newValue);
    const newValues = Object.assign({}, values);
    setValueOnObject(path as string, newValues, newValue);
    doValidation(newValues);
    values = newValues;
    setValues(values);
  }

  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>): void {
    setFieldVisited(currentTarget.name);
  }

  function setFieldVisited(fieldName: string) {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [fieldName]: true
    } as FieldsVisited<FIELDS>;
    fieldsVisited = newFieldsVisited;
    doValidation(values);
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


  const onMultiFieldRemove = (path: Path, idx: number) => {
    let newArray = (getValueFromObject(path, values) as []).filter((e, myIdx) => idx !== myIdx);
    setValue(path, newArray);
  }
  //onMultiFieldChange: (pi: Pizza, idx: number) => void;
  const onMultiAdd = (path: Path) => {
    const initial: any[] = getValueFromObject(path, values) as any[];
    // TODO das wird noch interessant.....
    const valueCreator: (() => object) | undefined = getValueFromObject(path,valueCreators);
    if (valueCreator) {
      const newArray = [...(initial)];
      newArray.push(valueCreator());
      setValue(path, newArray);
    } else {
      console.error(`No valueCreator for ${path} was supplied. 
      Adding values is impossible. To change this supply 
      an object with a valueCreator for ${path} to useForm`);
    }
  }

  //
  // ############################################################## Sub-Object Operations
  // 

  function subEditorProps<T>(parentFieldName: any, value: T, idx: number): SubEditorProps<T> {
    return {
      inputProps: function (childFieldName: keyof T): FormFieldInput {
        const path: Path = `${parentFieldName}[${idx}].${childFieldName}`
        return createIndividualFields(path);
      }
    }
  }

  // 
  // Construction of return value
  //


  // 
  function createIndividualFields<T>(fieldName: [keyof FIELDS] | Path): FormFieldInput {
    const path = fieldName as Path;
    const value = getValueFromObject(path , values);
    const isArray = value instanceof Array;
    const newErrors= errors[path];

    const ret: FormFieldInput = {
      // @ts-ignore
      value: value,
      // @ts-ignore
      errorMessages: newErrors,
      name: fieldName as string,
      onChange: updateValues,
      onBlur: updateVisitedFields,
      onValueChange: (newValue: any) => setValue(path, newValue),
      onBlurChange: () => setFieldVisited(path as string)
    };

    if (isArray) {
      const rv = ret as any;
      rv['onRemove'] = (idx: number) => onMultiFieldRemove(path, idx);
      rv['onAdd'] = () => onMultiAdd(path);
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
type HTMLInputEventEmitter =(e: React.ChangeEvent<HTMLInputElement>) => void;
type HTMLFocusEventEmitter =(e: React.FocusEvent<HTMLInputElement>) => void;
type InputEventEmitter =(newValue: any) => void;
type FocusEventEmitter =() => void;

export interface FormFieldInput {
  value: any;
  errorMessages: any;
  name: string;
  onChange: HTMLInputEventEmitter ;
  onBlur: HTMLFocusEventEmitter ;
  onValueChange: InputEventEmitter;
  onBlurChange: FocusEventEmitter
};

export interface CustomEditorProps<T> {
  value: T;
  errorMessages: any;
  onValueChange: InputEventEmitter;
  onBlurChange: FocusEventEmitter
}

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

  