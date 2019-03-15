import ReactDOM from "react-dom";
import React from "react";

import { render, fireEvent, cleanup, waitForElement, wait, getByText } from 'react-testing-library'
import { useFormInternal, State, SubFormStates, createInitialState, ParentFormAdapter, SubmitState, ValidateFn, RecordError } from './useForm'
import { act }  from 'react-dom/test-utils';
let container: HTMLElement | null;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});

afterEach(() => {
    if (container) {
        document.body.removeChild(container);
        container = null;
    }
});
interface TestData {
    foo: string
}
var result:any = '';
it('useForm: initial', () => {
    const testData: TestData = { foo: 'bar' };
    const parentFormAdapter:ParentFormAdapter = {
        onChange: (x)=>{ console.log('onChange: ' , x)},
        onValidChange: (x) => { console.log('onValidChange ', x)},
        state: SubmitState.INVOKE_SUBMIT,
        submitRequested: false
    }
    const newLocal = createInitialState(testData);
    
    console.log('initial state' , newLocal);
    act( () => { ReactDOM.render(<TestRunner 
        initialState={newLocal as any} 
        initialSubFormStates={new SubFormStates()} 
        fields={testData} 
        parentFormAdapter={parentFormAdapter}
        />, container)});
    
});


function TestRunner<FORM_DATA extends TestData>(props: {
    fields: TestData,
    initialState: State<FORM_DATA>,
    initialSubFormStates: SubFormStates,
    parentFormAdapter?: ParentFormAdapter
}
) {
    const { fields, initialState, initialSubFormStates,parentFormAdapter } = props;
    const validate:ValidateFn<TestData> = (data, errorRecorder:RecordError<TestData>) => {
        console.log('validate called');
        errorRecorder('foo', 'asdfasf');
    }
    result = useFormInternal('testform',validate, fields, () => { }, {}, initialState, initialSubFormStates,parentFormAdapter);
    return <br />
}