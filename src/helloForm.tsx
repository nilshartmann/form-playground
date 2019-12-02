import React from "react";
import {FormFieldInput, useForm, ValidateFn} from "./form/useForm";
import ErrorDisplay from "./form/errorDisplay";

function submitFn(data: HelloData) {
    alert('Hello ' + data.hello);
}

const validate: ValidateFn<HelloData> = (newValues, re, red) => {
    if (newValues.hello === '') {
        re('hello', 'Ein name muss schon sein');
    }
};

interface HelloData {
    hello: string;
}

const initialData: HelloData = {
    hello: ''
};

export default function Hello(): React.ReactElement {
    const [overallFormState, form] = useForm('hello form', validate, initialData, submitFn);
    let helloElement:FormFieldInput = form.input('hello');
    return <div>
        name: <input type="text" onChange={helloElement.onChange} onBlur={helloElement.onBlur} name={helloElement.name}
                     defaultValue={helloElement.value}></input><br/>

        <ErrorDisplay visited={helloElement.visited} errorMessages={helloElement.errorMessages}></ErrorDisplay>

        <button type="submit" value="Say hello"
                disabled={overallFormState.submitRequested && overallFormState.hasErrors}
                onClick={overallFormState.handleSubmit}>Hallo sagen
        </button>

    </div>
}