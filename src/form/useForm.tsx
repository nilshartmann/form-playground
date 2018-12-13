import { useState } from "react";
import {setValueOnObject,getValueFromObject} from './helpers'
import { stat } from "fs";


//
// Validation Helpers ###########################################################
//
/**
 * A function that creates the RecordError helper function.
 * 
 * @param errors the objects where the errors should be recorded in
 */
function createErrorRecorder<FIELDS>(errors: FormErrors<FIELDS>):RecordError<FIELDS> {
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
/**
 * 
 * Computes the new state of the Form after an async validation.
 * 
 * @param validate the form's validator function
 * @param newState the current state of the form
 * @param asyncVF an async validator function
 */
function getNewStateAfterAsyncValidation<FIELDS>(
  validate: ValidateFn<FIELDS>,
  newState: State<FIELDS>, 
  setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>,
  asyncVF: AsyncValidatorFunction<FIELDS>,
  path?:Path): State<FIELDS> {
  const newErrors: FormErrors<FIELDS> = {} as FormErrors<FIELDS>;
  const errorRecorder = createErrorRecorder(newErrors);
  // first validate the on async field
  asyncVF(newState.values, errorRecorder);
  const validating = {...(newState.validating as any)}
  if (path) {
    //@ts-ignore (why could validating[path] be undefined)     
    validating[path]--;
  }
  
  // then validate anything else...
  validate(newState.values,
    fieldName => (newState.fieldsVisited[fieldName] === true),
    errorRecorder,
    // ...omitting anything that should be validated delayed
    DontValidateAnythingDelayed
  );
  console.log('newState ', newState);
  return { ...newState, errors: newErrors, validating: validating}
}

/**
 * Creator function for the ValidateAsync helper function.
 */
function createValidateDelayed<FIELDS>(
  state: State<FIELDS>,
  setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>,
  validate: ValidateFn<FIELDS>
): ValidateAsync<FIELDS> {
  
  const validateAsyncFunction: ValidateAsync<FIELDS> = function (promise: Promise<AsyncValidatorFunction<FIELDS>>, path?:Path) {
    const validating = {...(state.validating as any)}
    if (path) {
      if (state.validating[path]!==undefined) {
        //@ts-ignore (why could validating[path] be undefined)     
        state.validating[path]++;
      } else {
        state.validating[path] = 1;
      }
    }
      
    promise.then((dvf: AsyncValidatorFunction<FIELDS>) => setState((newState) => getNewStateAfterAsyncValidation(validate, newState, setState, dvf, path)));
  }
  return validateAsyncFunction;

}
const DontValidateAnythingDelayed: ValidateAsync<any> = (p) => { };


type Fields<FIELDS> = { [P in keyof FIELDS]: any };
type Partial<T> = { [P in keyof T]: T[P] };

type FieldsVisited<FIELDS> = { [P in keyof FIELDS | string]?: boolean };
type Validating<FIELDS> = { [P in keyof FIELDS | string]?: number };
type FormErrors<FIELDS> = { [P in keyof FIELDS | string]?: string[] | null };

type Path = string;

/**
 * Each complex element that is used in an array within the form's data model, must be created by a ValueCreator function,
 * which must be registered in here.
 */
export type ValueCreators<FIELDS> = { [P in keyof FIELDS]?: () => object };
/**
 * A funtion that 'records' an error.
 * @param field to which field does the error belong?
 * @param message the error message to be recorded
 * @param exclusive if true any other previously recorded errors will be overwritten
 * 
 */
export type RecordError<FIELDS> =
  (field: keyof FIELDS | string, msg: string, exclusive?: boolean) => void;

  /**
 * A function that is called after an asynchronous validation took place. An error recorder and the current value
 * of the validated field is being passed to the function, as the value could have changed while validation was 
 * in progress. Set the error, if after waiting for the async validation, the field is still invalid, in here.
 */
export type AsyncValidatorFunction<FIELDS> = (currentValue: FIELDS, errorRecorder: RecordError<FIELDS>) => void;
/**
 * Registers a promise for an async validation. When the promis resolves the supplies AsyncValidatorFunction is called.
 */
export type ValidateAsync<FIELDS> = (promise: Promise<AsyncValidatorFunction<FIELDS>>, fieldname?:Path) => void;

/**
 * A validator function validates all the forms values.
 * 
 * @param newValues the current form's values
 * @param isVisited a function to check if the field was visited
 * @param recordError an ErrorRecorder to record the errors
 * @param validateDelayed a function to register a delayed validator
 */
export type ValidateFn<FIELDS> = (
  newValues: Partial<FIELDS>,
  isVisited: (fieldName: keyof FIELDS | string) => boolean,
  recordError: RecordError<FIELDS>,
  validateDelayed: ValidateAsync<FIELDS>
) => void;
//
// useFormHook ########################################################################
//

interface State<FIELDS> {
  values: Fields<FIELDS>;
  submitted: boolean;
  fieldsVisited: FieldsVisited<FIELDS>;
  errors: FormErrors<FIELDS>,
  validating: Validating<FIELDS>
}

function setStateSave<FIELDS>( field: keyof State<FIELDS>, value: any): (x:State<FIELDS>) => State<FIELDS> {
  return (s: State<FIELDS>) => {
    s[field] = value;
    return s;
  }
}

/**
 * A hook that creates everything that's required for building a form.
 * 
 * @param validate a validator function for your form
 * @param fields the initial value of the form
 * @param submit the function to be executed on submit if the form state is valid
 * @param valueCreators an (optional) object which contains creator functions for array based fields
 */
export function useForm<FORM_DATA>(
  validate: ValidateFn<FORM_DATA>,
  fields: Fields<FORM_DATA>,
  submit: () => void,
  valueCreators: ValueCreators<FORM_DATA> = {}
): [OverallState<FORM_DATA>, FormInputFieldPropsProducer<any>] {
  const [state, setState] = useState({ values: fields, submitted: false, fieldsVisited: {}, errors: {}, validating: {} } as State<FORM_DATA>);;
  let { values, submitted, fieldsVisited, errors } = state;
  const setValues = (v: Fields<FORM_DATA>) => setState(setStateSave('values', v));
  const setSubmitted = (v: boolean) => setState(setStateSave('submitted', v));
  const setFieldsVisited = (v: FieldsVisited<FORM_DATA>) => setState(setStateSave('fieldsVisited', v));
  const setErrors = (v: FormErrors<FORM_DATA>) => setState(setStateSave('errors', v ));
  console.log('this.state.validating  ', state.validating);
  //
  // validation ##############################################################
  // 
  const doValidation = (newValues: Partial<FORM_DATA>, allFields: boolean = submitted) => {
    const newErrors: FormErrors<FORM_DATA> = {};
    validate(
      newValues,
      fieldName => (fieldsVisited[fieldName] === true) || (allFields === true),
      createErrorRecorder(newErrors),
      createValidateDelayed(state, setState, validate)
    );
    setErrors(newErrors);
    return newErrors;
  }

  //
  // update values etc. ##############################################################
  // 

  /**
   * Helper to update field values from ChangeEvents.
   * @param param a change Event
   */
  function updateValues({ currentTarget }: React.ChangeEvent<HTMLInputElement>): void {
    setValue(currentTarget.name as keyof FORM_DATA, currentTarget.value);
  }

  /**
   * sets newValue under path and validates the form afterwards.
   * @param path the path on which the value should be set
   * @param newValue the new value
   */
  const setValue = (path: Path | keyof FORM_DATA, newValue: any) => {
    const newValues = Object.assign({}, values);
    setValueOnObject(path as string, newValues, newValue);
    doValidation(newValues);
    values = newValues;
    setValues(values);
  }

  /**
   * Helper to update the list of visited fields after a BlurEvents.
   * @param param a blur Event
   */
  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>): void {
    setFieldVisited(currentTarget.name);
  }

  function setFieldVisited(fieldName: string) {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(fieldsVisited as any),
      [fieldName]: true
    } as FieldsVisited<FORM_DATA>;
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
  function createIndividualFields(fieldName: [keyof FORM_DATA] | Path): FormFieldInput {
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
      onBlurChange: () => setFieldVisited(path as string),
      //@ts-ignore (how could state.validating[path] be undefined here?)
      validating: state.validating[path] !== undefined && state.validating[path] > 0
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
  ] as [OverallState<FORM_DATA>, FormInputFieldPropsProducer<any>];
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
/**
 * Properties for HTMLInputFields.
 */
export interface FormFieldInput {
  value: any;
  errorMessages: any;
  name: string;
  onChange: HTMLInputEventEmitter ;
  onBlur: HTMLFocusEventEmitter ;
  onValueChange: InputEventEmitter;
  onBlurChange: FocusEventEmitter,
  validating: boolean
};

/**
 * Props for custom editors for any values other than primitive types such as boolean, string or number.
 */
export interface CustomEditorProps<T> {
  value: T;
  errorMessages: any;
  onValueChange: InputEventEmitter;
  onBlurChange: FocusEventEmitter
}
/**
 * Properties for editors for array based fields
 */
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

  