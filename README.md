# React Forms with Hooks 

# Requirements

- We have a form with n input fields

- When the user changes a field the form should be validated. As there are dependencies between fields, the whole form must be validated (it's not enough just to validate the field the user is currently editing)

- A field should only be validated if the user has entered at least one character there. "Untouched" fields should not be validate on (only when the form will be submitted)

# How does it work

In general forms in React require you to write some functions that handle validation, updates of your data etc. E.g.
```
function SimpleForm() {
  function validate(e:React.ChangeEvent<HTMLInputElement>) {
...
  }
  function saveValue(e:React.ChangeEvent<HTMLInputElement>) {
...
  }
  function submit(){
...
  }
  return (
    <div className="App">
      <input type="text" onChange={saveValue} onBlur={validate} defaultValue={value}></input>
      <h2>{error}</h2>
      <button onClick={submit}>Submit</button>
    </div>
  );
}
```

[Codesandbox Example](https://codesandbox.io/s/summer-grass-ntiy2)

This example has a lot of errors, but it shows how you could do it. Once the errors are being fixed the functions grow 
more complex, plus they have to be converted to make them reusable. This is where this 'small' form framework comes to 
the rescue: It supplies the required functions via a hook.

Here is a simple, yet working and bugfree exmaple with the useForm hook:

```typescript jsx
import React from "react";
import {FormFieldInput, useForm, ValidateFn} from "./form/useForm";
import ErrorDisplay from "./form/errorDisplay";

// first: define the structure of your data
interface HelloData {
    hello: string;
}

// second: define a submit function, trigger your backend call here:
function submitFn(data: HelloData) {
    alert('Hello ' + data.hello);
}

// third: define a validate function for your whole form
const validate:ValidateFn<HelloData> = (newValues, re, red) => {
    // only one element, but more are possible
    if (newValues.hello === '') {
        re('hello', 'Ein name muss schon sein');
    }
};
// fourth: Define the initial state of your form's data
const initialData:HelloData = {
    hello: ''
}
// last: define the form
export default function Hello():React.ReactElement {
    const [overallFormState, form] = useForm('hello form', validate,initialData, submitFn);
    // form consists of three constructor functions which give you access to the onBlur, onChange etc. functions
    // from the hook. Here the input function for HTMLInput elements is used:
    let helloElement:FormFieldInput = form.input('hello');

    return <div>
        <!-- here the funtions are bound to the input element -->
        name: <input type="text" onChange={helloElement.onChange} onBlur={helloElement.onBlur} name={helloElement.name}
                     defaultValue={helloElement.value}></input><br/>
        <!-- the FormFieldInput element also holds the errors assiciated with the field -->
        <ErrorDisplay visited={helloElement.visited} errorMessages={helloElement.errorMessages}></ErrorDisplay>

        <!-- the sectond object 'overallFormState' has (among others) informations required to set the state of the
        submit button, such as, was a submit requeste at all? Do we have errors? Etc.-->
        <button type="submit" value="Say hello"
                disabled={overallFormState.submitRequested && overallFormState.hasErrors}
                onClick={overallFormState.handleSubmit}>Hallo sagen
        </button>
        
    </div>
}
```

Apart from the input() function used in the example there are two more functions that will enable you to create all
sorts of forms:

* multi - for editors with multiple values (to edit array based model values)
* custom - for editors that have a custom interface such as a date-picker

Examples for the usage of all these functions can be found in orderForm.tsx

# Implemented features (undocumented so far)

* FormField to model mapping
* customInputs (date-pickers, color pickers) are possible
* 1:n relations (array operations) are possible
* sub forms are possible. You can for example build a reusable, self validating address form
* asynchronous validations, for example for server side renderings, are possible
* control of the submit button can be done via information from the hook

# TODOs

* FormFieldInput should get an additional field inputElementProps, which bundles all the props for an input element in 
jsx (onChange, onBlur, name, defaultValue). With that things get more compact: 
```<input type="text" {...form.input('hello').inputElementProps} >...```
* useForm takes too many parameters. A parameter object should be used instead
* it would probably make sense to add a delay before change events are being processed so that the overall number
of redraws and validations can be reduced. (This is just an idea, which still need sorrow checking!) 