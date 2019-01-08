import { useState, SyntheticEvent, useEffect } from "react";
import { setValueOnObject, getValueFromObject } from './helpers'
import { promises } from "fs";



//
// Validation Helpers ###########################################################
//
/**
 * A function that creates the RecordError helper function.
 * 
 * @param errors the objects where the errors should be recorded in
 */
function createErrorRecorder<FIELDS>(errors: FormErrors<FIELDS>): RecordError {
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


// /**
//  * 
//  * Computes the new state of the Form after an async validation.
//  * 
//  * @param validate the form's validator function
//  * @param newState the current state of the form
//  * @param asyncVF an async validator function
//  */


function createAsyncErrorRecorder<FIELDS>(currentState: State<FIELDS>,
  setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>): RecordErrorAsync {
  return (path: Path, newErrorPromise: Promise<string | null>) => {
    // remeber the prmoise... 
    if (currentState.validating[path] !== undefined) {
      //@ts-ignore (why could validating[path] be undefined)     
      currentState.validating[path].push(newErrorPromise);
    } else {
      currentState.validating[path] = [newErrorPromise];
    }
    newErrorPromise.then(applyErrorAsync<FIELDS>(currentState.values, setState, path));
  };
}

function applyErrorAsync<FIELDS>(oldValues: Fields<FIELDS>, setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>, 
  path: string) : (newError: string|null) => void {
  return (newError) => {
    setState((newState) => {
      return buildNewStateAfterAsyncValidation<FIELDS>(oldValues, newState, newError, path);
    });
  };
}

function buildNewStateAfterAsyncValidation<FIELDS>(oldValues: Fields<FIELDS>,newState: State<FIELDS>, newError: string | null, path: string) {
  //@ts-ignore
  const validating = { ...(newState.validating) };
  //@ts-ignore
  if ((validating[path] as []).length === 0) {
    return newState;
  }
  const oldValue = getValueFromObject(path, oldValues);
  const newValue = getValueFromObject(path, newState.values);
  if (newValue !== oldValue) {
    // validated value is obsolete.
    return newState;
  } else {
    validating[path] = [];
  }

  const newErrors: FormErrors<FIELDS> = newState.errors;
  if (newError) {
    newErrors[path] = [newError];
  } else {
    delete newErrors[path];
  }
  return { ...newState, validating, errors: newErrors };
}


type Fields<FIELDS> = { [P in keyof FIELDS]: any };
type Partial<T> = { [P in keyof T]: T[P] };

type FieldsVisited<FIELDS> = { [P in keyof FIELDS | string]?: boolean };
type Validating<FIELDS> = { [P in keyof FIELDS | string]?: Promise<string | null>[] };
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
export type RecordError =
  (field: Path | string, msg: string, exclusive?: boolean) => void;
export type RecordErrorAsync =
  (field: Path | string, msg: Promise<string | null>) => void;

/**
* A function that is called after an asynchronous validation took place. An error recorder and the current value
* of the validated field is being passed to the function, as the value could have changed while validation was 
* in progress. Set the error, if after waiting for the async validation, the field is still invalid, in here.
*/
export type AsyncValidatorFunction<FIELDS> = (currentValue: FIELDS, errorRecorder: RecordError) => void;
/**
 * Registers a promise for an async validation. When the promis resolves the supplies AsyncValidatorFunction is called.
 */
export type ValidateAsync<FIELDS> = (promise: Promise<AsyncValidatorFunction<FIELDS>>, fieldname: Path) => void;

export type isFieldVisitedFunction<FIELDS> = (fieldName: keyof FIELDS | string) => boolean;

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
  isVisited: isFieldVisitedFunction<FIELDS>,
  recordError: RecordError,
  recordErrorDelayed: RecordErrorAsync
) => void;

enum SubmitState {
  /**
   * initial state. no submit activity is going on.
   */
  NONE,
  /**
   * a submit has been requested by the user. The form is now doing the neccessary checks to submit.
   */
  INVOKE_SUBMIT,
  /**
   * everyting was ok. The form can be submitted, the users submit action will be invoked.
   */
  SUBMITTING
}
//
// useFormHook ########################################################################
//

interface State<FIELDS> {
  values: Fields<FIELDS>;
  submitRequested: boolean;
  /**
   * After a submit is requested, the form is in s
   */
  submitState: SubmitState;
  fieldsVisited: FieldsVisited<FIELDS>;
  errors: FormErrors<FIELDS>,
  validating: Validating<FIELDS>
}

export interface Form<FORM_DATA> {
  data: FORM_DATA,
  input: FormInputFieldPropsProducer<FormFieldInput, any, FORM_DATA>;
  multi: FormInputFieldPropsProducer<MultiFormInput<any>, any, FORM_DATA>;
  custom: FormInputFieldPropsProducer<CustomObjectInput<any>, any, FORM_DATA>;
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
  submit: (values: Fields<FORM_DATA>) => void,
  valueCreators: ValueCreators<FORM_DATA> = {}
): [OverallState<FORM_DATA>, Form<FORM_DATA>] {
  const [state, setState] = useState({ values: fields, submitRequested: false, fieldsVisited: {}, errors: {}, validating: {} } as State<FORM_DATA>);;
  let { values, errors } = state;
  useEffect(() => {
    if (state.submitState === SubmitState.SUBMITTING) {
      submit(state.values);
      setState({ ...state, submitState: SubmitState.NONE });
    }
  });

  //
  // validation ##############################################################
  // 
  const doValidation = (currentState: State<FORM_DATA>, allFields: boolean): State<FORM_DATA> => {
    const newErrors: FormErrors<FORM_DATA> = {};
    const newState = { ...currentState, errors: newErrors };
    validate(
      newState.values,
      fieldName => (currentState.fieldsVisited[fieldName] === true) || (allFields === true),
      createErrorRecorder(newErrors),
      createAsyncErrorRecorder(newState, setState)
    );
    return newState;
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
    setState(currentState => {
      console.log('old ', state, ' new ', currentState);
      return setValueOnState(path, newValue, currentState);
    })
  }

  const setValueOnState = (path: Path | keyof FORM_DATA, newValue: any, currentState: State<FORM_DATA>) => {
    let newState = { ...currentState };
    const newValues = Object.assign({}, currentState.values);
    setValueOnObject(path as string, newValues, newValue);
    newState.values = newValues
    newState = doValidation(newState, state.submitRequested);
    newState.submitState = SubmitState.NONE;
    return newState;

  }

  /**
   * Helper to update the list of visited fields after a BlurEvents.
   * @param param a blur Event
   */
  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement>): void {
    setFieldVisited(currentTarget.name);
  }

  function setFieldVisited(fieldName: string) {
    setState(currentState => {
      let newState = { ...currentState };
      const newFieldsVisited = {
        // https://stackoverflow.com/a/51193091/6134498
        ...(currentState.fieldsVisited as any),
        [fieldName]: true
      } as FieldsVisited<FORM_DATA>;
      newState.fieldsVisited = newFieldsVisited;
      newState = doValidation(newState, state.submitRequested);
      newState.submitState = SubmitState.NONE;
      return newState;
    });

  }

  function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setState((state) => {
      let newState = doValidation(state, true);
      newState = { ...newState, submitRequested: true, submitState: SubmitState.INVOKE_SUBMIT };
      const pendingPromises: Promise<string | null>[] = []
      Object.values(state.validating).map((values: Promise<string | null>[] | undefined) => {
        if (values) {
          pendingPromises.push(...values);
        }
      });
      Promise.all(pendingPromises).then(x => {
        setState(s => {
          if (Object.keys(s.errors).length === 0) {
            return { ...s, submitState: SubmitState.SUBMITTING };
          } else {
            return { ...s, submitState: SubmitState.NONE };
          }

        });
      });
      return { ...newState };
    });
  }
  //
  // ############################################################ Multi Field Operations
  //


  const onMultiFieldRemove = (path: Path, idx: number) => {
    setState(currentState => {
      let newArray = (getValueFromObject(path, currentState.values) as []).filter((e, myIdx) => idx !== myIdx);
      return setValueOnState(path, newArray, currentState);
    })
  }
  const onMultiAdd = (path: Path) => {
    setState(currentState => {
      const initial: any[] = getValueFromObject(path, currentState.values) as any[];
      // TODO das wird noch interessant.....
      const valueCreator: (() => object) | undefined = getValueFromObject(path, valueCreators);
      if (valueCreator) {
        const newArray = [...(initial)];
        newArray.push(valueCreator());
        return setValueOnState(path, newArray, currentState);
      } else {
        console.error(`No valueCreator for ${path} was supplied. 
      Adding values is impossible. To change this supply 
      an object with a valueCreator for ${path} to useForm`);
        return currentState;
      }
    });
  }

  // 
  // Construction of return value
  //
  function createBaseIndividualFields(fieldName: Path): FormField<any> {
    const path = fieldName as Path;
    const value = getValueFromObject(path, values);
    const newErrors = errors[path];
    const ret: FormField<any> = {
      value: value,
      errorMessages: newErrors,
      name: fieldName as string,
      //@ts-ignore (how could state.validating[path] be undefined here?)
      validating: state.validating[path] !== undefined && state.validating[path].length > 0,
      submitting: state.submitState === SubmitState.INVOKE_SUBMIT
    };
    return ret;
  }

  function createArrayFields<ARRAY_CONTENT_TYPE>(path: Path): MultiFormInput<ARRAY_CONTENT_TYPE> {
    const ret = createBaseIndividualFields(path) as MultiFormInput<any>;
    ret.onRemove = (idx: number) => onMultiFieldRemove(path, idx);
    ret.onAdd = () => onMultiAdd(path);

    ret.subEditorProps = (newValue: any, idx: number) => {
      const pathPrefix: Path = `${path}[${idx}].`
      return createForm({ ...newValue }, pathPrefix);
    }
    return ret;
  }

  function createCustomFields(path: Path): CustomObjectInput<any> {
    const ret = createBaseIndividualFields(path) as CustomObjectInput<any>;

    ret.onValueChange = (newValue: any) => setValue(path, newValue);
    ret.onBlurChange = () => setFieldVisited(path as string);
    return ret;
  }

  function createInputFields(path: Path): FormFieldInput {
    const ret = createBaseIndividualFields(path) as FormFieldInput;
    ret.onChange = updateValues;
    ret.onBlur = updateVisitedFields;

    return ret;

  }
  function createForm(data: FORM_DATA, parentPath: Path = ''): Form<FORM_DATA> {

    return {
      data: data,
      custom: (path: keyof FORM_DATA) => createCustomFields(parentPath + path),
      multi: (path: keyof FORM_DATA) => createArrayFields(parentPath + path),
      input: (path: keyof FORM_DATA) => createInputFields(parentPath + path)
    }

  }


  return [
    // "overall" form state
    {
      hasErrors: Object.keys(errors).length > 0,
      values: values,
      errors: errors,
      setValue: setValue,
      handleSubmit: handleSubmit

    },
    createForm(values)
  ] as [OverallState<FORM_DATA>, Form<FORM_DATA>];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  errors: FormErrors<FIELDS>;
  values: Partial<FIELDS>;
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: () => void;
};
type HTMLInputEventEmitter = (e: React.ChangeEvent<HTMLInputElement>) => void;
type HTMLFocusEventEmitter = (e: React.FocusEvent<HTMLInputElement>) => void;
type InputEventEmitter = (newValue: any) => void;
type FocusEventEmitter = () => void;
type IndexType = { [key: string]: any }
export interface FormField<T> {
  value: T;
  errorMessages: any;
  name: string;
  validating: boolean;
  submitting: boolean;
}
/**
* Properties for HTMLInputFields.
*/
export interface FormFieldInput extends FormField<any> {
  onChange: HTMLInputEventEmitter;
  onBlur: HTMLFocusEventEmitter;
};

/**
 * Props for custom editors for any values other than primitive types such as boolean, string or number.
 */
export interface CustomObjectInput<T> extends FormField<T> {
  onValueChange: InputEventEmitter;
  onBlurChange: FocusEventEmitter
}
/**
 * Properties for editors for array based fields
 */
export interface MultiFormInput<ARRAY_CONTENT_TYPE> extends FormField<Array<ARRAY_CONTENT_TYPE>> {
  onValueUpdate: (pi: ARRAY_CONTENT_TYPE, idx: number) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  subEditorProps(value: any, idx: number): Form<ARRAY_CONTENT_TYPE>
}

export interface SubEditorProps<ARRAY_CONTENT_TYPE> extends Form<ARRAY_CONTENT_TYPE> {

}

export type FormInputFieldPropsProducer<R extends FormField<T>, T extends IndexType, FORM_DATA> =
  (key: keyof FORM_DATA) => R;

