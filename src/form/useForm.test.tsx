import React, { useState } from "react";
import { render, fireEvent, cleanup, waitForElement, wait, getByText } from 'react-testing-library'
import { OverallState, ValidateFn, useForm, Form, ValueCreators, MultiFormInput, RecordError, RecordErrorAsync, CustomObjectInput, ParentFormAdapter } from "./useForm";
import ErrorDisplay from './errorDisplay';
import { exec } from "child_process";
afterEach(() => { console.log('-----------------------------------------'); cleanup() });

it('use_Form: should display no validation errors when opened', () => {
    const wrapper = render(<TestForm submit={() => { }} subForm={false} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
});
it('use_Form: should display validation errors when submitted', () => {
    const wrapper = render(<TestForm submit={() => { }} subForm={false}/>);
    const submit:HTMLButtonElement = wrapper.getByText('submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(1);
    expect(submit.disabled).toBe(true);    
});
it('use_Form: should not display validation errors with correct values', () => {
    const wrapper = render(<TestForm submit={() => { }} subForm={false}/>);
    const submit:HTMLButtonElement = wrapper.getByText('submit') as HTMLButtonElement;
    const input:HTMLInputElement = wrapper.getByTestId('fieldOne') as HTMLInputElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(1);
    expect(submit.disabled).toBe(true);    
    changeInputValue(input, 'b');
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    
});
it('useForm: should display validation errors in SubForms', () => {
    const wrapper = render(<TestForm submit={() => { }} subForm={true}/>);
    const submit:HTMLButtonElement = wrapper.getByText('submit') as HTMLButtonElement;
    const input:HTMLInputElement = wrapper.getByTestId('fieldOne') as HTMLInputElement;
    expect(submit.disabled).toBe(false);
    changeInputValue(input, 'b');
    fireEvent.click(submit);
    const errorFields = wrapper.queryAllByTestId("error-display");
    expect(errorFields).toHaveLength(1);
    expect(errorFields[0].textContent).toEqual('subFieldOneInvalid');
    
});

it('useForm: should add values in a subEditor', () => {
    const wrapper = render(<TestForm submit={() => { }} subForm={true} />);
    if (overallFormState !== undefined) {
        expect(overallFormState.values['multiField'].length).toEqual(0);
        const submit: HTMLButtonElement = wrapper.getByText('submit') as HTMLButtonElement;
        const addButton: HTMLButtonElement = wrapper.getByTestId('multiadd') as HTMLButtonElement;
        fireEvent.click(addButton);
        expect(overallFormState.values['multiField'].length).toEqual(1);
        const textfield: HTMLInputElement = wrapper.getByTestId('subfieldinput0') as HTMLInputElement;
        changeInputValue(textfield,'newValue');
        expect(overallFormState.values['multiField'][0].simpleSubFieldOne).toEqual('newValue');
        fireEvent.click(addButton);
        expect(overallFormState.values['multiField'].length).toEqual(2);
        changeInputValue((wrapper.getByTestId('subfieldinput1') as HTMLInputElement),'otherValue');
        expect(overallFormState.values['multiField'][1].simpleSubFieldOne).toEqual('otherValue');
        wrapper.debug;

    } else {
        fail("FormState is undefiend");
    }

});


function changeInputValue(input: HTMLInputElement, newValue: string) {
    fireEvent.change(input, {
        target: { value: newValue },
    });
}



const validate: ValidateFn<TestFormData> = function (
    newFormInput,
    recordError: RecordError<TestFormData>,
    recordErrorAsync: RecordErrorAsync<TestFormData>) {
    if (newFormInput['fieldOne'].startsWith('invalid')) {
        recordError('fieldOne', 'fieldOneInvalid');
    }
}

interface SimpleSubItem {
    simpleSubFieldOne: string;
}
interface TestFormData {
    fieldOne: string;
    multiField: SimpleSubItem[];
    subForm: TestSubFormData | undefined;
}

const initialValues = {
    fieldOne: 'invalid',
    multiField: [],
    subForm: undefined
}
const valueCreators = {
    multiField: () => ({ simpleSubFieldOne: 'initial' })
}
let overallFormState: OverallState<TestFormData> | undefined;

function TestForm(props: { submit: () => void, subForm: boolean }) {
    const usedForm = useForm<TestFormData>('order form', validate, initialValues, props.submit, valueCreators);
    overallFormState = usedForm[0];
    const form = usedForm[1];
    const { input, multi, custom } = form;
    const isDisabled = overallFormState.submitRequested && overallFormState.hasErrors;
    const fieldOne = input('fieldOne');
    return (
        <div className="Form">
            <input type='text' name={fieldOne.name} onChange={fieldOne.onChange} onBlur={fieldOne.onBlur} data-testid='fieldOne' />
            <SimpleMultiEdior {...multi('multiField')} />
            <ErrorDisplay visited={fieldOne.visited} errorMessages={fieldOne.errorMessages} />
            {props.subForm ? <TestSubForm parent={form.getParentFormAdapter('subForm')} /> : ''}
            <button disabled={isDisabled} onClick={overallFormState.handleSubmit} >
                submit
        </button>
        </div>
    );
}

function SimpleMultiEdior(props: MultiFormInput<SimpleSubItem>) {
    return <div>
        <button onClick={() => props.onAdd()} data-testid="multiadd">add</button>
        {
            props.value.map((pi: SimpleSubItem, idx: number) =>
                <div>
                <SimpleSubEditor value={pi} key={idx} idx={idx} onValueUpdate={(element) => props.onValueUpdate(element, idx)} />
                Version: {props.getVersion(idx)}
                </div>    
            )
        }
    </div>
}

function SimpleSubEditor(props: { idx:number, value: SimpleSubItem, onValueUpdate: (element: SimpleSubItem) => void; }) {
    return <div>
        <input type='text' data-testid={"subfieldinput" + props.idx} value={props.value.simpleSubFieldOne} onChange={e => props.onValueUpdate({ simpleSubFieldOne: e.target.value })} />
    </div>
}

interface TestSubFormData {
    subFieldOne: 'a'
}

const validateSubForm: ValidateFn<TestSubFormData> = function (newFormInput,
    recordError: RecordError<TestSubFormData>,
    recordErrorAsync: RecordErrorAsync<TestSubFormData>) {
    if (newFormInput['subFieldOne'].startsWith('invalid')) {
        recordError('subFieldOne', 'subFieldOneInvalid');
    }
}

function TestSubForm(props: { parent: ParentFormAdapter }) {
    const [overallFormState, form] = useForm<TestSubFormData>('sub form', validateSubForm, { subFieldOne: 'invalid' }, () => { }, {}, props.parent);
    const { input, multi, custom } = form;
    console.log(`subform sr ${overallFormState.submitRequested}, he ${overallFormState.hasErrors} ${JSON.stringify(overallFormState.errors)}`);
    const fieldOne = input('subFieldOne');
    return (
        <div className="Form">
            <input type='text' name={fieldOne.name} onChange={fieldOne.onChange} onBlur={fieldOne.onBlur} data-testid='fieldOne' />
            <ErrorDisplay visited={fieldOne.visited} errorMessages={fieldOne.errorMessages} />
        </div>
    );

}
