import { useReducer, SyntheticEvent, useEffect, useState, Reducer } from "react";
import { number } from "prop-types";

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

function createAsyncErrorRecorder<FIELDS>(currentState: State<FIELDS>,
  dispatch: React.Dispatch<FormAction<FIELDS>>
  ): RecordErrorAsync<FIELDS> {
  return (path: Path<FIELDS>, newErrorPromise: Promise<string | null>) => {
    // remeber the prmoise... 
    if (currentState.validating[path] !== undefined) {
      //@ts-ignore (why could validating[path] be undefined)     
      currentState.validating[path].push(newErrorPromise);
    } else {
      currentState.validating[path] = [newErrorPromise];
    }
    newErrorPromise.then(applyErrorAsync<FIELDS>(currentState.values, dispatch, path));
  };
}

function applyErrorAsync<FIELDS>(oldValues: Fields<FIELDS>,
  dispatch: React.Dispatch<FormAction<FIELDS>>,
  path: Path<FIELDS>
): (newError: string | null) => void {
  return (newError) => {
    dispatch({actionType: ActionType.APPLY_ERRORS_ASYNC, path, oldValues, newError});
  };
}

function buildNewStateAfterAsyncValidation<FIELDS>(
  oldValues: Fields<FIELDS>,
  currentState: State<FIELDS>,
  newError: string | null, path: Path<FIELDS>
) {
  console.log(`buildNewStateAfterAsyncValidation called`);
  //@ts-ignore
  const validating = { ...(currentState.validating) };
  //@ts-ignore
  if (!validating[path]) {
    return currentState;
  }
  const oldValue = oldValues[path];
  const newValue = currentState.values[path];
  if (newValue !== oldValue) {
    // validated value is obsolete.
    return currentState;
  } else {
    delete (validating[path]);
  }
  const newErrors: FormErrors<FIELDS> = {...currentState.errors};
  if (newError) {
    newErrors[path] = [newError];
  } else {
    delete newErrors[path];
  }
  const newState = { ...currentState, validating, errors: newErrors };
  return newState;
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

export enum ValidationState {
  VALID, VALIDATING, INVALID
}

export enum SubmitState {
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
/**
 * Internal State - Exported for Test only! Do not use in production!
 */
export interface State<FIELDS> {
  values: Fields<FIELDS>;
  submitRequested: boolean;
  submitState: SubmitState;
  fieldsVisited: FieldsVisited<FIELDS>;
  errors: FormErrors<FIELDS>,
  validating: Validating<FIELDS>,
  validated: boolean
}

export interface Form<FORM_DATA> {
  data: FORM_DATA,
  input: FormInputFieldPropsProducer<FormFieldInput, any, FORM_DATA>;
  multi: FormInputFieldPropsProducer<MultiFormInput<any>, any, FORM_DATA>;
  custom: FormInputFieldPropsProducer<CustomObjectInput<any>, any, FORM_DATA>;
  getParentFormAdapter: (key: keyof FORM_DATA) => ParentFormAdapter;
}

type SubFormStateMap = {
  [P: string]: ValidationState;
}
type Path<FORM_DATA> = keyof FORM_DATA;
/**
 * Internal class for the SubFormStates. Do not use in production!
 */
export class SubFormStates {
  getState(path: string): ValidationState | undefined {
    return this.subFormStateMap[path];
  }
  private readonly subFormStateMap: SubFormStateMap;
  constructor(data?: SubFormStates) {
    if (data) {
      this.subFormStateMap = data.subFormStateMap;
    } else {
      this.subFormStateMap = {};
    }
  }
  validating(): boolean {
    const subFormStates = Object.values(this.subFormStateMap);
    return subFormStates.some((subFormState: ValidationState) => subFormState === ValidationState.VALIDATING);
  }
  setSubFormState(name: string, newState: ValidationState) {
    this.subFormStateMap[name] = newState;
  }
  allValid(): boolean {
    const subFormStates = Object.values(this.subFormStateMap);
    return subFormStates.length === 0 || !subFormStates.some((subFormState: ValidationState) => subFormState !== ValidationState.VALID);
  }

  toString() {
    return '[SubFormState: ' + JSON.stringify(this.subFormStateMap) + ']';
  }
}

/**
 * Function to create the complex inital state. Exported only for testing purposes.
 * @param fields 
 */
export function createInitialState<FORM_DATA>(fields: Fields<FORM_DATA>): State<FORM_DATA> {
  return {
    values: fields,
    submitRequested: false,
    fieldsVisited: {},
    errors: {},
    validating: {},
    validated: false,
    submitState: SubmitState.NONE
  }
}

function isValid<FORM_DATA>(state: State<FORM_DATA>, caller = ''): boolean {
  console.log(`${caller} num errors ${Object.keys(state.errors).length} num validating ${Object.keys(state.validating).length}`);
  const ret = Object.keys(state.errors).length === 0 && Object.keys(state.validating).length === 0;
  return ret;
}
function calcValidationState<FORM_DATA>(state: State<FORM_DATA>, subFormStates: SubFormStates) {
  const pendingPromises: Promise<string | null>[] = [];
  Object.values(state.validating).map((values: Promise<string | null>[] | undefined) => {
    if (values) {
      pendingPromises.push(...values);
    }
  });
  if (pendingPromises.length > 0 || subFormStates.validating()) {
    return ValidationState.VALIDATING;
  } else if (isValid(state, 'cvc') && subFormStates.allValid()) {
    return ValidationState.VALID;
  } else {
    return ValidationState.INVALID;
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
  formname: string,
  validate: ValidateFn<FORM_DATA>,
  fields: Fields<FORM_DATA>,
  submit: (values: Fields<FORM_DATA>) => void,
  valueCreators: ValueCreators<FORM_DATA> = {},
  parentForm?: ParentFormAdapter
): [OverallState<FORM_DATA>, Form<FORM_DATA>] {
  return useFormInternal(formname, validate, fields, submit, valueCreators, createInitialState(fields), new SubFormStates(), parentForm);
}

enum ActionType {
  SUBMIT, END_SUBMIT, VALIDATE, SET_VALUE, FIELD_VISITED, MULTI_FIELD_REMOVE, MULTI_FIELD_ADD, APPLY_ERRORS_ASYNC
}

type FormAction<FORM_DATA> =
{ actionType: ActionType.END_SUBMIT } |
{ actionType: ActionType.VALIDATE, dispatch: React.Dispatch<FormAction<FORM_DATA>>, validate: ValidateFn<FORM_DATA> } |
{ actionType: ActionType.SET_VALUE, path: Path<any>, newValue: any, idx: number | null ,  dispatch: React.Dispatch<FormAction<FORM_DATA>>, validate: ValidateFn<FORM_DATA>} |
{ actionType: ActionType.SUBMIT } |
{ actionType: ActionType.MULTI_FIELD_REMOVE, path: Path<FORM_DATA>, idx: number,  dispatch: React.Dispatch<FormAction<FORM_DATA>>, validate: ValidateFn<FORM_DATA>} |
{ actionType: ActionType.MULTI_FIELD_ADD, path: Path<FORM_DATA>, valueCreators: ValueCreators<FORM_DATA>, dispatch: React.Dispatch<FormAction<FORM_DATA>>, validate: ValidateFn<FORM_DATA> } |
{ actionType: ActionType.FIELD_VISITED, fieldname: string }|
{ actionType: ActionType.APPLY_ERRORS_ASYNC, 
    oldValues: Fields<FORM_DATA>,  
    newError: string | null, 
    path: Path<FORM_DATA>};


 //
  // validation ##############################################################
  // 
  function doValidation<FORM_DATA extends IndexType>(
    currentState: State<FORM_DATA>, 
    dispatch: React.Dispatch<FormAction<FORM_DATA>>,
    validate: ValidateFn<FORM_DATA>
    ): State<FORM_DATA> {
    const newErrors: FormErrors<FORM_DATA> = {};
    const newState = { ...currentState, errors: newErrors, validated: true };
    if (typeof dispatch !== 'function') {
      throw 'Stop ' + dispatch;
    }
   validate(
      newState.values,
      fieldName => (currentState.fieldsVisited[fieldName] === true) /* TODO: ob man das noch mal braucht? || (allFields === true)*/,
      createErrorRecorder(newErrors),
      createAsyncErrorRecorder(newState, dispatch)
    );
    return newState;
  }

  function formReducer<FORM_DATA extends IndexType>(state: State<FORM_DATA>, action: FormAction<FORM_DATA>): State<FORM_DATA> {
    console.log(` Performing Action ${ActionType[action.actionType]} State: ${JSON.stringify(state)}`)
    switch (action.actionType) {
      case ActionType.SUBMIT:
        return { ...state, submitRequested: true, submitState: SubmitState.SUBMITTING };
      case ActionType.END_SUBMIT:
        return { ...state, submitState: SubmitState.NONE };
      case ActionType.MULTI_FIELD_REMOVE:
        let newArray = (state.values[action.path] as []).filter((e, myIdx) => action.idx !== myIdx);
        return formReducer(state, 
          { actionType: ActionType.SET_VALUE, 
            idx: null, 
            path: action.path, 
            newValue: newArray, 
            dispatch: action.dispatch, 
            validate: action.validate }
            );
      case ActionType.MULTI_FIELD_ADD:
        const initial: any[] = state.values[action.path] as any[];
        // TODO das wird noch interessant.....
        const valueCreator: (() => object) | undefined = action.valueCreators[action.path];
        if (valueCreator) {
          const newArray = [...(initial)];
          newArray.push(valueCreator());
          return formReducer(state, { actionType: ActionType.SET_VALUE, idx: null, path: action.path, newValue: newArray,dispatch: action.dispatch, 
            validate: action.validate });
        } else {
          console.error(`No valueCreator for ${action.path} was supplied. 
      Adding values is impossible. To change this supply 
      an object with a valueCreator for ${action.path} to useForm`);
          return state;
        }
        case ActionType.APPLY_ERRORS_ASYNC: 
        return buildNewStateAfterAsyncValidation(action.oldValues, state, action.newError, action.path);
      case ActionType.VALIDATE:
        {
          const newState= doValidation(state, action.dispatch, action.validate);
          console.log(`new State : ${JSON.stringify(newState)}`);
          return newState;
        }
      case ActionType.FIELD_VISITED:
        const newFieldsVisited = {
          // https://stackoverflow.com/a/51193091/6134498
          ...(state.fieldsVisited as any),
          [action.fieldname]: true
        } as FieldsVisited<FORM_DATA>;
        return { ...state, fieldsVisited: newFieldsVisited, submitState: SubmitState.NONE }

      case ActionType.SET_VALUE:
        let newState = { ...state };
        const newValues = Object.assign({}, state.values) as FORM_DATA;
        if (action.idx !== null) {
          (newValues[action.path as string] as any)[action.idx] = action.newValue;
        } else {
          newValues[action.path as string] = action.newValue;
        }
        newState.values = newValues;
        newState = doValidation(newState, action.dispatch, action.validate);
        newState.submitState = SubmitState.NONE;
        return newState;
      default:
        throw `Unsupported Action ${JSON.stringify(action)} is not implemented`;
    }
  };


/**
 * internal constructor for testing purposes only. Do not use in production!
 */
export function useFormInternal<FORM_DATA extends IndexType>(
  formname: string,
  validate: ValidateFn<FORM_DATA>,
  fields: Fields<FORM_DATA>,
  submit: (values: Fields<FORM_DATA>) => void,
  valueCreators: ValueCreators<FORM_DATA> = {},
  initialState: State<FORM_DATA>,
  initialSubFormStates: SubFormStates,
  parentForm?: ParentFormAdapter

): [OverallState<FORM_DATA>, Form<FORM_DATA>] {
  console.log('Use Form called.');
  //  let newArray = (currentState.values[path] as []).filter((e, myIdx) => idx !== myIdx);
  //  return setValueOnState(path, newArray, currentState, null);
  const logPrefix = (parentForm !== undefined) ? 'child: ' : 'parent: ';


 
  console.log(`${logPrefix} now using reducer`)
  const fr:Reducer<State<FORM_DATA>, FormAction<FORM_DATA>> = formReducer;
  const [state, dispatch] = useReducer(fr, initialState);
  const [subFormStates, setSubFormStates] = useState(initialSubFormStates);
  const overallValidationState = calcValidationState(state, subFormStates);

  console.log(`${formname} (${logPrefix}) submitstate: ${SubmitState[state.submitState]} subFormStates valid? ${subFormStates.allValid()}}`)

  // Es sollte einen status für validation geben: invalid, valid, validation_in_progress.
  // wenn Submitting && alle Kinder valid -> submit
  // wenn submitting && ich oder kind invalid -> abort
  // in allen anderen zuständen: warten.
  useEffect(() => {
    if (parentForm === undefined) {
      if (state.submitState === SubmitState.SUBMITTING) {
        if (overallValidationState === ValidationState.VALID) {
          dispatch({ actionType: ActionType.END_SUBMIT });
          submit(state.values as any /* TODO */);
        } else if (overallValidationState === ValidationState.INVALID) {
          console.log('Submit aborted.');
          dispatch({ actionType: ActionType.END_SUBMIT });
        } else {
          console.log('Validation in progress. Waiting...');
        }
      }
    } else {
      console.log(`${formname} (${logPrefix}) invoking onValidChange ${isValid(state, formname)} subFormStates: ${subFormStates}`);
      parentForm.onValidChange(overallValidationState);
      parentForm.onChange(state.values);
    }
  }, [state.submitState, state.values, overallValidationState]);
  useEffect(() => {

    if (!state.validated) {
      console.log(logPrefix + ' dispatching initial validate');
      dispatch({ actionType: ActionType.VALIDATE, dispatch, validate })
      // TODO
      //      if (parentForm) {
      //        parentForm.onValidChange(calcValidationState(newState, subFormStates));
      //      }
    }

  }, [state.validated]);


  //
  // update values etc. ##############################################################
  // 

  /**
   * Helper to update field values from ChangeEvents.
   * @param param a change Event
   */
  function updateValues({ currentTarget }: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void {
    setValue(currentTarget.name as keyof FORM_DATA, currentTarget.value);
  }

  /**
   * sets newValue under path and validates the form afterwards.
   * @param path the path on which the value should be set
   * @param newValue the new value
   * @param idx when the value at path is an array, the index must be supplied to change just the value at the index.
   */
  const setValue = (path: Path<FORM_DATA>, newValue: any, idx: number | null = null) => {
    dispatch({ actionType: ActionType.SET_VALUE, path, newValue, idx, dispatch, validate });
  }

  /**
   * Helper to update the list of visited fields after a BlurEvents.
   * @param param a blur Event
   */
  function updateVisitedFields({ currentTarget }: React.FocusEvent<HTMLInputElement | HTMLSelectElement>): void {
    setFieldVisited(currentTarget.name);
  }

  function setFieldVisited(fieldName: string) {
    dispatch({ actionType: ActionType.FIELD_VISITED, fieldname: fieldName });

  }

  function handleSubmit(e?: SyntheticEvent) {
    console.log('-----------------------------------------------------');
    console.log('submitting');
    console.log('-----------------------------------------------------');
    dispatch({ actionType: ActionType.SUBMIT });
  }
  //
  // ############################################################ Multi Field Operations
  //


  const onMultiFieldRemove = (path: Path<FORM_DATA>, idx: number) => {
    dispatch({ actionType: ActionType.MULTI_FIELD_REMOVE, idx, path, dispatch, validate });
  }
  const onMultiAdd = (path: Path<FORM_DATA>) => {
    dispatch({actionType: ActionType.MULTI_FIELD_ADD, path, dispatch, validate, valueCreators});
  }

  // 
  // Construction of return value
  //
  function createBaseIndividualFields(path: Path<FORM_DATA>): FormField<any> {
    const value = state.values[path];
    const newErrors = state.errors[path];
    const submitRequested = (parentForm && parentForm.submitRequested) || state.submitRequested;
    const ret: FormField<any> = {
      value: value,
      errorMessages: newErrors,
      name: path as string,
      visited: state.fieldsVisited[path] !== undefined || submitRequested,
      //@ts-ignore (how could state.validating[path] be undefined here?)
      validating: state.validating[path] !== undefined && state.validating[path].length > 0,
      submitting: state.submitState === SubmitState.INVOKE_SUBMIT
    };
    return ret;
  }

  function getParentFormAdapterInternal<TYPE>(path: Path<FORM_DATA>, idx: number | null) {
    const newAdapter: ParentFormAdapter = {
      state: state.submitState,
      submitRequested: state.submitRequested || (parentForm !== undefined && parentForm.submitRequested),
      onValidChange: (newValid: ValidationState) => {
        const idxString = idx === null ? '' : idx;
        const pathString = path as string + idxString
        if (subFormStates.getState(pathString) !== newValid) {
          console.log(`${formname} (${logPrefix}) SubFormState for path ${pathString} has changed from ${subFormStates.getState(pathString)} to ${newValid}`);
          setSubFormStates(sfs => {
            sfs.setSubFormState(pathString, newValid);
            return new SubFormStates(sfs);
          });
        } else {
          console.log(`${formname} (${logPrefix}) SubFormState for path ${pathString} remains ${newValid}`);

        }
      },
      onChange: (newValue: TYPE) => {
        let oldValue;
        if (idx !== null) {
          oldValue = (state.values[path] as any)[idx] = newValue;
        } else {
          oldValue = state.values[path];
        }
        if (oldValue !== newValue) {
          setValue(path, newValue, idx);
        }
      }
    }
    return newAdapter;
  };

  function createArrayFields<ARRAY_CONTENT_TYPE>(path: Path<FORM_DATA>): MultiFormInput<ARRAY_CONTENT_TYPE> {
    const ret = createBaseIndividualFields(path) as MultiFormInput<any>;
    ret.onRemove = (idx: number) => onMultiFieldRemove(path, idx);
    ret.onAdd = () => onMultiAdd(path);
    ret.getParentFormAdapter = (idx: number) => getParentFormAdapterInternal<ARRAY_CONTENT_TYPE>(path, idx);
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
      input: (path: keyof FORM_DATA) => createInputFields(path),
      getParentFormAdapter: (path: keyof FORM_DATA) => getParentFormAdapterInternal(path, null)
    }

  }
  const overallFormState: OverallState<FORM_DATA> = {
    hasErrors: !(isValid(state, formname) && subFormStates.allValid()),
    values: state.values,
    errors: state.errors,
    setValue: setValue,
    submitRequested: state.submitRequested,
    handleSubmit: handleSubmit
  }

  return [
    // "overall" form state
    overallFormState,
    createForm(state.values)
  ] as [OverallState<FORM_DATA>, Form<FORM_DATA>];
}

type OverallState<FIELDS> = {
  hasErrors: boolean;
  submitRequested: boolean;
  errors: FormErrors<FIELDS>;
  values: Partial<FIELDS>;
  setValue: (field: keyof FIELDS, value: string) => void;
  handleSubmit: (e: SyntheticEvent) => void;
};
type HTMLInputEventEmitter = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
type HTMLFocusEventEmitter = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
type InputEventEmitter = (newValue: any) => void;
type FocusEventEmitter = () => void;
type IndexType = { [key: string]: any }
export interface FormField<T> {
  value: T;
  errorMessages: any;
  name: string;
  validating: boolean;
  submitting: boolean;
  visited: boolean;
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
  submitRequested: boolean;
  onValidChange: (newValidationState: ValidationState) => void;
  onChange: (newValue: any) => void
}

