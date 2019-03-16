import { useReducer, SyntheticEvent, useEffect, useState, Reducer } from "react";

// ##############################################################################
// Public interfaces 
// ##############################################################################

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
  return useFormInternal(formname, validate, submit, valueCreators, createInitialState(fields), new SubFormStates(), parentForm);
}

/**
 * A validator function validates all the forms values. Important: The validators are called _very_ often. At least after
 * any change in any of your form's fields. So while implementing those: Be sure to make them as fast as possible. For example
 * a serverside validation should only be triggered when all the values are plausible, and answers should be cached. This however
 * is something that the form, not this hook, must do!
 * 
 * @param newValues the current form's values
 * @param recordError an ErrorRecorder to record the errors
 * @param validateDelayed a function to register a delayed validator
 */
export type ValidateFn<FIELDS> = (
  newValues: Partial<FIELDS>,
  recordError: RecordError<FIELDS>,
  recordErrorDelayed: RecordErrorAsync<FIELDS>
) => void;

type Fields<FIELDS> = { [P in keyof FIELDS]: any };

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
/**
* A funtion that 'records' an error asynchronously. The promise must resolve to a message if an the field in Path is invalid,
* or resolve to null otherwise.
* @param field to which field does the error belong?
* @param a promise which can resolve to a validation-failed message
* 
*/
export type RecordErrorAsync<FIELDS> =
  (field: Path<FIELDS>, msg: Promise<string | null>) => void;

/**
 * The overall state of a form
 */
export type OverallState<FIELDS> = {
  /**
   * Are any errors present 
   * TODO: this needs a more specific definition
   */
  hasErrors: boolean;
  /**
   * Has a submit been requested at least once (turns to to true at the first attempt and stays true from then)
   */
  submitRequested: boolean;
  /**
   * all the validation errors in the form
   */
  errors: FormErrors<FIELDS>;
  /**
   * the currently collected values form the form's fields
   */
  values: Partial<FIELDS>;
  /**
   * a function to set a value on a field. 
   * TODO: is this still required
   */
  setValue: (field: keyof FIELDS, value: string) => void;
  /**
   * The submit handler function. Must be called to submit your form values. If everything validates this function will call 
   * the function <code>submit</code> passed to useForm.
   */
  handleSubmit: (e: SyntheticEvent) => void;
};
/**
 * A type that consists of any subset of props in T
 */
export type Partial<T> = { [P in keyof T]: T[P] };
/**
 * the errors in the form. 
 * TODO explain the key format.
 */
export type FormErrors<FIELDS> = { [P in keyof FIELDS | string]?: string[] | null };

/**
 * An object providing everything neccessary to connect your form's GUI to this hook.
 */
export interface Form<FORM_DATA> {
  /**
   * a function to create the neccessary callbacks for HTML-input Fields. Use it like this:
   * 
   * <input {...input('somfieldsname')} />
   * 
   * @see FormInputFieldPropsProducer for more information.
   */
  input: FormInputFieldPropsProducer<FormFieldInput, FORM_DATA>;
  /**
   * a function to create the neccessary callbacks for components which let the user edit array like fields. Use it like this:
   * 
   * <MyCustomMultiEditorComponent {...mulit('somfieldsname')} />
   * 
   * @see FormInputFieldPropsProducer for more information.
   */
  multi: FormInputFieldPropsProducer<MultiFormInput<any>, FORM_DATA>;
  /**
   * a function to create the neccessary callbacks for custom input components, like a select-box with suggestions. Use it like this:
   * 
   * <SuggestionSelectBox {...custom('somfieldsname')} />
   * 
   * @see FormInputFieldPropsProducer for more information.
   */
  custom: FormInputFieldPropsProducer<CustomObjectInput<any>, FORM_DATA>;
  /**
   * Returns an adapter which can be used to connect a child form to this form. This is helpful if you are building partial forms
   * with their own validations, that should be reused in larger forms. E.g. an address-form which has it's own address validation
   * but is included in your order form and your customers registration form.
   * @param key the key in your parents form where the data from the sub form resides.
   */
  getParentFormAdapter: (key: keyof FORM_DATA) => ParentFormAdapter;
}

/**
 * Properties for editors for array based fields
 */
export interface MultiFormInput<ARRAY_CONTENT_TYPE> extends FormField<Array<ARRAY_CONTENT_TYPE>> {
  /**
   * Must be called everytime an element of the array is changed.
   * @param element modified element
   * @param idx the index in the array
   */
  onValueUpdate: (element: ARRAY_CONTENT_TYPE, idx: number) => void;
  /**
   * Must be called to remove an element of the array.
   * @param idx the index in the array
   */
  onRemove: (idx: number) => void;
  /**
   * Must be called to add a new element to the array. The element is created by an  .
   * @param idx the index in the array
   */
  onAdd: () => void;
  /**
   * returns a <code>ParentFormAdapter</code> for the specific element. Use this for elements
   * that require a sub-form.
   * 
   * @param the element's index.
   */
  getParentFormAdapter: (idx: number) => ParentFormAdapter;
}
/**
 * A parentFormAdapter is a bridge between a child form and it's parent. Any form can be 'connected'
 * to another form. By doing so the validation process of both the forms is combined so that a submit
 * is only possible when both the child and the parent are valid.
 * 
 * Instances of this adapter should not be created by user code, but only by the useForm hook. They must
 * be passed unmodified to the child form to ensure proper functionality. 
 */
export interface ParentFormAdapter {
  state: SubmitState;
  submitRequested: boolean;
  onValidChange: (newValidationState: ValidationState) => void;
  onChange: (newValue: any) => void
}

/**
 * Base values for a FormField
 */
export interface FormField<T> {
  /**
   * the current value of this FormField
   */
  value: T;
  /** 
   * The error messages currently associated with this form field. 
  */
  errorMessages: any;
  /**
   * The FormField's name (corresponds to the object's property this filed manages)
   */
  name: string;
  /**
   * Is the validation for this field in progress.
   */
  validating: boolean;
  /**
   * Is the form this field belongs to submitting
   */
  submitting: boolean;
  /**
   * has this field been 'visited'? This is true if the field gained and lost focus once.
   */
  visited: boolean;
}
/**
* Properties for HTMLInputFields.
*/
export interface FormFieldInput extends FormField<any> {
  /**
   * the onChange function, should be attached to the input field's onChange property.
   */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  /**
   * the onBlur function, should be attached to the input field's onBlur property.
   */
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

/**
 * Props for custom editors for any values other than primitive types such as boolean, string or number.
 */
export interface CustomObjectInput<T> extends FormField<T> {
  /**
   * This callback has to be called everytime the input changes
   */
  onValueChange: (newValue: any) => void;
  /**
   * This callback has to be called everytime the input isBlurred.
   */
  onBlurChange: () => void
}

/**
 * A FormInputFieldPropsProducer creates an object which contains functions for adapting an input
 * element (be it a HTML-input field or a custom input field) to the form.
 * @param R the type of the FormField. Since this is a generic function the concrete output must
 * is specified by this type
 * @param FORM_DATA the type of the object, which the form that uses the objects created here, 
 * manages.
 */
export type FormInputFieldPropsProducer<R extends FormField<any>, FORM_DATA> =
  (key: keyof FORM_DATA) => R;


// ##############################################################################
// validation helpers 
// ##############################################################################


function isValid<FORM_DATA>(state: State<FORM_DATA>): boolean {
  const ret = Object.keys(state.errors).length === 0 && Object.keys(state.validating).length === 0;
  return ret;
}

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
    dispatch(new ApplyErrorAsync(path, oldValues, newError));
  };
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
  } else if (isValid(state) && subFormStates.allValid()) {
    return ValidationState.VALID;
  } else {
    return ValidationState.INVALID;
  }
}

// ##############################################################################
// useForm Hook 
// ##############################################################################

/**
 * internal constructor for testing purposes only. Do not use in production!
 */
export function useFormInternal<FORM_DATA extends IndexType>(
  formname: string,
  validate: ValidateFn<FORM_DATA>,
  submit: (values: Fields<FORM_DATA>) => void,
  valueCreators: ValueCreators<FORM_DATA> = {},
  initialState: State<FORM_DATA>,
  initialSubFormStates: SubFormStates,
  parentForm?: ParentFormAdapter

): [OverallState<FORM_DATA>, Form<FORM_DATA>] {
  const logPrefix = (parentForm !== undefined) ? 'child: ' : 'parent: ';
  const [state, dispatch] = useReducer(
    (state: State<FORM_DATA>, 
      action: FormAction<FORM_DATA>) => {
        console.log(`Executing action ${JSON.stringify(action)}`);
        return action.execute(state)}, 
      initialState);
  const [subFormStates, setSubFormStates] = useState(initialSubFormStates);
  const overallValidationState = calcValidationState(state, subFormStates);

  // Es sollte einen status für validation geben: invalid, valid, validation_in_progress.
  // wenn Submitting && alle Kinder valid -> submit
  // wenn submitting && ich oder kind invalid -> abort
  // in allen anderen zuständen: warten.
  useEffect(() => {
    if (parentForm === undefined) {
      if (state.submitState === SubmitState.SUBMITTING) {
        if (overallValidationState === ValidationState.VALID) {
          dispatch(new EndSubmitAction());
          submit(state.values as any);
        } else if (overallValidationState === ValidationState.INVALID) {
          dispatch(new EndSubmitAction());
        } else {
          console.trace('Validation in progress. Waiting...');
        }
      }
    } else {
      parentForm.onValidChange(overallValidationState);
      parentForm.onChange(state.values);
    }
  }, [state.submitState, state.values, overallValidationState]);
  useEffect(() => {

    if (!state.validated) {
      dispatch(new ValidateAction(dispatch, validate));
    }

  }, [state.validated]);

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
          dispatch(new SetValueAction(path, newValue, dispatch, validate, idx));
        }
      }
    }
    return newAdapter;
  };

  function createArrayFields<ARRAY_CONTENT_TYPE>(path: Path<FORM_DATA>): MultiFormInput<ARRAY_CONTENT_TYPE> {
    const ret = createBaseIndividualFields(path) as MultiFormInput<any>;
    ret.onRemove = (idx: number) => dispatch(new MultiFieldRemoveAction(path, idx, dispatch, validate));
    ret.onAdd = () => dispatch(new MultiFieldAddAction(path, valueCreators, dispatch, validate));
    ret.getParentFormAdapter = (idx: number) => getParentFormAdapterInternal<ARRAY_CONTENT_TYPE>(path, idx);
    return ret;
  }

  function createCustomFields(path: Path<FORM_DATA>): CustomObjectInput<any> {
    const ret = createBaseIndividualFields(path) as CustomObjectInput<any>;
    
    ret.onValueChange = (newValue: any) => dispatch(new SetValueAction(path, newValue, dispatch, validate));
    ret.onBlurChange = () => dispatch(new FieldVisitedAction(path as string));
    return ret;
  }

  function createInputFields(path: Path<FORM_DATA>): FormFieldInput {
    const ret = createBaseIndividualFields(path) as FormFieldInput;
    ret.onChange = (e) => dispatch(new SetValueAction(e.currentTarget.name as keyof FORM_DATA, e.currentTarget.value, dispatch, validate));;
    ret.onBlur = (e) => dispatch(new FieldVisitedAction(e.currentTarget.name));
    return ret;

  }
  function createForm(): Form<FORM_DATA> {

    return {
      custom: (path: keyof FORM_DATA) => createCustomFields(path),
      multi: (path: keyof FORM_DATA) => createArrayFields(path),
      input: (path: keyof FORM_DATA) => createInputFields(path),
      getParentFormAdapter: (path: keyof FORM_DATA) => getParentFormAdapterInternal(path, null)
    }

  }
  const overallFormState: OverallState<FORM_DATA> = {
    hasErrors: !(isValid(state) && subFormStates.allValid()),
    values: state.values,
    errors: state.errors,
    setValue: (path, newValue) => dispatch(new SetValueAction(path, newValue, dispatch, validate)),
    submitRequested: state.submitRequested,
    handleSubmit: () => dispatch(new SubmitAction())
  }

  return [
    // "overall" form state
    overallFormState,
    createForm()
  ] as [OverallState<FORM_DATA>, Form<FORM_DATA>];
}



// ##############################################################################
// Actions 
// ##############################################################################


class MultiFieldAddAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private path: Path<FORM_DATA>, private valueCreators: ValueCreators<FORM_DATA>, private dispatch: React.Dispatch<FormAction<FORM_DATA>>, private validate: ValidateFn<FORM_DATA>) { }

  execute(state: State<FORM_DATA>) {
    const initial: any[] = state.values[this.path] as any[];
    // TODO das wird noch interessant.....
    const valueCreator: (() => object) | undefined = this.valueCreators[this.path];
    if (valueCreator) {
      const newArray = [...(initial)];
      newArray.push(valueCreator());
      return new SetValueAction(this.path, newArray, this.dispatch, this.validate).execute(state);
    } else {
      console.error(`No valueCreator for ${this.path} was supplied. 
  Adding values is impossible. To change this supply 
  an object with a valueCreator for ${this.path} to useForm`);
      return state;
    }
  }
}
class MultiFieldRemoveAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private path: Path<FORM_DATA>, private idx: number, private dispatch: React.Dispatch<FormAction<FORM_DATA>>, private validate: ValidateFn<FORM_DATA>) { }
  execute(state: State<FORM_DATA>) {
    let newArray = (state.values[this.path] as []).filter((e, myIdx) => this.idx !== myIdx);
    return new SetValueAction(this.path, newArray, this.dispatch, this.validate).execute(state);
  }
}
class SetValueAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private path: Path<FORM_DATA>, private newValue: any, private dispatch: React.Dispatch<FormAction<FORM_DATA>>, private validate: ValidateFn<FORM_DATA>, private idx: number | null = null) { }
  execute(state: State<FORM_DATA>) {
    let newState = { ...state };
    const newValues = Object.assign({}, state.values) as FORM_DATA;
    if (this.idx !== null) {
      (newValues[this.path as string] as any)[this.idx] = this.newValue;
    } else {
      newValues[this.path as string] = this.newValue;
    }
    newState.values = newValues;
    newState = new ValidateAction(this.dispatch, this.validate).execute(newState);
    newState.submitState = SubmitState.NONE;
    return newState;
  }
}

class SubmitAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  execute(state: State<FORM_DATA>): State<FORM_DATA> {
    return { ...state, submitRequested: true, submitState: SubmitState.SUBMITTING };
  }
}
class EndSubmitAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  execute(state: State<FORM_DATA>): State<FORM_DATA> {
    return { ...state, submitState: SubmitState.NONE };
  }
}
class ValidateAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private dispatch: React.Dispatch<FormAction<FORM_DATA>>, private validate: ValidateFn<FORM_DATA>) { }
  execute(currentState: State<FORM_DATA>): State<FORM_DATA> {
    const newErrors: FormErrors<FORM_DATA> = {};
    const newState = { ...currentState, errors: newErrors, validated: true };
    if (typeof this.dispatch !== 'function') {
      throw 'Stop ' + this.dispatch;
    }
    this.validate(
      newState.values,
      createErrorRecorder(newErrors),
      createAsyncErrorRecorder(newState, this.dispatch)
    );
    return newState;
  }
}

class FieldVisitedAction<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private fieldname: string) { }
  execute(state: State<FORM_DATA>): State<FORM_DATA> {
    const newFieldsVisited = {
      // https://stackoverflow.com/a/51193091/6134498
      ...(state.fieldsVisited as any),
      [this.fieldname]: true
    } as FieldsVisited<FORM_DATA>;
    return { ...state, fieldsVisited: newFieldsVisited, submitState: SubmitState.NONE }
  }
}

class ApplyErrorAsync<FORM_DATA extends IndexType> implements FormAction<FORM_DATA> {
  constructor(private path: Path<FORM_DATA>, private oldValues: Fields<FORM_DATA>, private newError: string | null) { }
  execute(currentState: State<FORM_DATA>): State<FORM_DATA> {
    //@ts-ignore
    const validating = { ...(currentState.validating) };
    //@ts-ignore
    if (!validating[this.path]) {
      return currentState;
    }
    const oldValue = this.oldValues[this.path];
    const newValue = currentState.values[this.path];
    if (newValue !== oldValue) {
      // validated value is obsolete.
      return currentState;
    } else {
      delete (validating[this.path]);
    }
    const newErrors: FormErrors<FORM_DATA> = { ...currentState.errors };
    if (this.newError) {
      newErrors[this.path] = [this.newError];
    } else {
      delete newErrors[this.path];
    }
    return { ...currentState, validating, errors: newErrors };
  }
}




// ###################################################################################################
// private types.
// ###################################################################################################

type IndexType = { [key: string]: any }
type FieldsVisited<FIELDS> = { [P in keyof FIELDS | string]?: boolean };
type Validating<FIELDS> = { [P in keyof FIELDS | string]?: Promise<string | null>[] };

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

type Path<FORM_DATA> = keyof FORM_DATA;

type SubFormStateMap = {
  [P: string]: ValidationState;
}
/**
 * Internal class for the SubFormStates. Do not use in user code!
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

interface FormAction<FORM_DATA extends IndexType> {
  execute(state: State<FORM_DATA>): State<FORM_DATA>;
}
