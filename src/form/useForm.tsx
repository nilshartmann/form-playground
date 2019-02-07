import { useState, SyntheticEvent, useEffect } from "react";
import { setValueOnObject, getValueFromObject } from './helpers'


//
// Validation Helpers ###########################################################
//
/**
 * A function that creates the RecordError helper function.
 * 
 * @param errors the objects where the errors should be recorded in
 */
function createErrorRecorder<FIELDS>(errors: FormErrors<FIELDS>): RecordError<FIELDS> {
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
  setState: React.Dispatch<React.SetStateAction<State<FIELDS>>>): RecordErrorAsync<FIELDS> {
  return (path: Path<FIELDS>, newErrorPromise: Promise<string | null>) => {
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
  path: Path<FIELDS>): (newError: string | null) => void {
  return (newError) => {
    setState((newState) => {
      return buildNewStateAfterAsyncValidation<FIELDS>(oldValues, newState, newError, path);
    });
  };
}

function buildNewStateAfterAsyncValidation<FIELDS>(oldValues: Fields<FIELDS>, newState: State<FIELDS>, newError: string | null, path: Path<FIELDS>) {
  //@ts-ignore
  const validating = { ...(newState.validating) };
  //@ts-ignore
  if ((validating[path] as []).length === 0) {
    return newState;
  }
  const oldValue = oldValues[path];
  const newValue = newState.values[path];
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
  (field: Path<FIELDS>, msg: string, exclusive?: boolean) => void;
export type RecordErrorAsync<FIELDS> =
  (field: Path<FIELDS>, msg: Promise<string | null>) => void;




export type isFieldVisitedFunction<FIELDS> = (fieldName: Path<FIELDS>) => boolean;

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
  recordError: RecordError<FIELDS>,
  recordErrorDelayed: RecordErrorAsync<FIELDS>
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

enum ValidationState {
  VALIDATING, VALID, INVALID
}
type SubFormStateMap<FORM_DATA> = {
  [P in Path<FORM_DATA>]?: ValidationState;
}
type Path<FORM_DATA> = keyof FORM_DATA;

class SubFormStates<FORM_DATA> {
  getState(path: Path<FORM_DATA>): ValidationState | undefined {
    return this.subFormStateMap[path];
  }
  private readonly subFormStateMap: SubFormStateMap<FORM_DATA> = {};
  setSubFormState(name: Path<FORM_DATA>, newState: ValidationState) {
    this.subFormStateMap[name] = newState;
  }
  allValid(): boolean {
    const subFormStates = Object.values(this.subFormStateMap);

    return subFormStates.length === 0 || subFormStates.some((subFormState: ValidationState) => subFormState === ValidationState.VALID);
  }
  setValidating() {
    Object.keys(this.subFormStateMap).forEach(key => this.subFormStateMap[key as Path<FORM_DATA>] = ValidationState.VALIDATING);
  }
  toString() {
    return '[SubFormState: ' + JSON.stringify(this.subFormStateMap) + ']';
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
  submit: (values: Fields<FORM_DATA>) => void,
  valueCreators: ValueCreators<FORM_DATA> = {},
  parentForm?: ParentFormAdapter
): [OverallState<FORM_DATA>, Form<FORM_DATA>] {
  const [state, setState] = useState({ values: fields, submitRequested: false, fieldsVisited: {}, errors: {}, validating: {} } as State<FORM_DATA>);;
  const [subFormStates, setSubFormStates] = useState(new SubFormStates<FORM_DATA>());
  let { values, errors } = state;
  const logPrefix = (parentForm !== undefined) ? 'child: ' : 'parent: ';
  console.log(logPrefix, 'useForm called, SubmitState: ', SubmitState[state.submitState])
  useEffect(() => {
    console.log(logPrefix, 'SubFormState: ', subFormStates.toString(), ' allValid? ', subFormStates.allValid());
    if (parentForm !== undefined /*childForm*/) {
      if (state.submitState === SubmitState.SUBMITTING && parentForm.state === SubmitState.NONE) {
        setState({ ...state, submitState: SubmitState.NONE });
      } else if (state.submitState === SubmitState.SUBMITTING && subFormStates.allValid()) {
        console.log(logPrefix, 'fire Sate Valid');
        parentForm.onStateChange(ValidationState.VALID);
      } else if (parentForm.state === SubmitState.INVOKE_SUBMIT &&
        state.submitState !== SubmitState.INVOKE_SUBMIT
      ) {
        console.log(logPrefix, 'Parent form requested submit, fire State Validating');
        parentForm.onStateChange(ValidationState.VALIDATING);
        handleSubmit();
      }
    } else {
      if (state.submitState === SubmitState.SUBMITTING && subFormStates.allValid()) {
        console.log(logPrefix, 'submitting...');
        setState({ ...state, submitState: SubmitState.NONE });
        submit(state.values);
      }
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
   * @param idx when the value at path is an array, the index must be supplied to change just the value at the index.
   */
  const setValue = (path: Path<FORM_DATA>, newValue: any, idx: number | null = null) => {
    setState(currentState => {
      const newState = setValueOnState(path, newValue, currentState, idx);
      if (parentForm) {
        parentForm.onChange(newState.values);
      }
      return newState;

    })

  }

  const setValueOnState = (path: Path<FORM_DATA>, newValue: any, currentState: State<FORM_DATA>, idx: number | null) => {
    let newState = { ...currentState };
    const newValues = Object.assign({}, currentState.values) as FORM_DATA;
    if (idx !== null) {
      (newValues[path] as any)[idx] = newValue;
    } else {
      newValues[path] = newValue;
    }
    newState.values = newValues;
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

  function handleSubmit(e?: SyntheticEvent) {
    if (e) {
      e.preventDefault();
    }
    console.log(logPrefix, 'handleSubmit ');
    setState((state) => {

      let newState = doValidation(state, true);
      newState = { ...newState, submitRequested: true, submitState: SubmitState.INVOKE_SUBMIT };

      setSubFormStates(sfs => { sfs.setValidating(); return sfs });

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


  const onMultiFieldRemove = (path: Path<FORM_DATA>, idx: number) => {
    setState(currentState => {
      let newArray = (currentState.values[path] as []).filter((e, myIdx) => idx !== myIdx);
      return setValueOnState(path, newArray, currentState, null);
    })
  }
  const onMultiAdd = (path: Path<FORM_DATA>) => {
    setState(currentState => {
      const initial: any[] = currentState.values[path] as any[];
      // TODO das wird noch interessant.....
      const valueCreator: (() => object) | undefined = valueCreators[path];
      if (valueCreator) {
        const newArray = [...(initial)];
        newArray.push(valueCreator());
        return setValueOnState(path, newArray, currentState, null);
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
  function createBaseIndividualFields(path: Path<FORM_DATA>): FormField<any> {
    const value = values[path];
    const newErrors = errors[path];
    const ret: FormField<any> = {
      value: value,
      errorMessages: newErrors,
      name: path as string,
      //@ts-ignore (how could state.validating[path] be undefined here?)
      validating: state.validating[path] !== undefined && state.validating[path].length > 0,
      submitting: state.submitState === SubmitState.INVOKE_SUBMIT
    };
    return ret;
  }

  function createArrayFields<ARRAY_CONTENT_TYPE>(path: Path<FORM_DATA>): MultiFormInput<ARRAY_CONTENT_TYPE> {
    const ret = createBaseIndividualFields(path) as MultiFormInput<any>;
    ret.onRemove = (idx: number) => onMultiFieldRemove(path, idx);
    ret.onAdd = () => onMultiAdd(path);


    ret.getParentFormAdapter = (idx: number) => {
      const newAdapter: ParentFormAdapter = {
        state: state.submitState,
        onStateChange: (newState) => {
          console.log(logPrefix, 'onStateChange ', ValidationState[newState], (parentForm === undefined));
          if (subFormStates.getState(path) !== newState) {
            setSubFormStates(sfs => { sfs.setSubFormState(path, newState); return sfs });
          }

        },
        onChange: (newValue: ARRAY_CONTENT_TYPE) => {

          setValue(path, newValue, idx);
        }
      }
      return newAdapter;
    };

    return ret;
  }

  function createCustomFields(path: Path<FORM_DATA>): CustomObjectInput<any> {
    const ret = createBaseIndividualFields(path) as CustomObjectInput<any>;

    ret.onValueChange = (newValue: any) => setValue(path, newValue);
    ret.onBlurChange = () => setFieldVisited(path as string);
    return ret;
  }

  function createInputFields(path: Path<FORM_DATA>): FormFieldInput {
    const ret = createBaseIndividualFields(path) as FormFieldInput;
    ret.onChange = updateValues;
    ret.onBlur = updateVisitedFields;

    return ret;

  }
  function createForm(data: FORM_DATA): Form<FORM_DATA> {

    return {
      data: data,
      custom: (path: keyof FORM_DATA) => createCustomFields(path),
      multi: (path: keyof FORM_DATA) => createArrayFields(path),
      input: (path: keyof FORM_DATA) => createInputFields(path)
    }

  }
  const overallFormState: OverallState<FORM_DATA> = {
    hasErrors: Object.keys(errors).length > 0,
    values: values,
    errors: errors,
    setValue: setValue,
    handleSubmit: handleSubmit
  }

  return [
    // "overall" form state
    overallFormState,
    createForm(values)
  ] as [OverallState<FORM_DATA>, Form<FORM_DATA>];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  errors: FormErrors<FIELDS>;
  values: Partial<FIELDS>;
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: (e: SyntheticEvent) => void;
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
  getParentFormAdapter: (idx: number) => ParentFormAdapter;
}

export type FormInputFieldPropsProducer<R extends FormField<T>, T extends IndexType, FORM_DATA> =
  (key: keyof FORM_DATA) => R;

export interface ParentFormAdapter {
  state: SubmitState;
  onStateChange: (newState: ValidationState) => void;
  onChange: (newValue: any) => void
}

